from typing import Dict, List, Any, TypedDict, Optional
from langgraph.graph import StateGraph, END
from ai_core.llm.ollama_client import ollama_client
import json
import asyncio

# Agent system prompts
CODER_SYSTEM = """You are a Coding Agent. Write production-quality code based on the task description.
Follow best practices, include error handling, type hints, and docstrings.
Output ONLY the code inside a ```python markdown block. No explanations."""

TESTER_SYSTEM = """You are a Testing Agent. Write a comprehensive test suite for the given code.
Output ONLY the test code inside a ```python markdown block."""

REVIEWER_SYSTEM = """You are a Code Review Agent. Review the code for:
1. Security vulnerabilities
2. Performance issues
3. Code quality and best practices
4. Bug detection
Output a brief 2-sentence review summary."""

REFACTOR_SYSTEM = """You are a Refactoring Agent. Optimize and improve the given code.
Focus on: performance, readability, DRY principles, design patterns.
Output ONLY the refactored code inside a ```python markdown block."""

class OrchestratorState(TypedDict):
    request: str
    context: Dict[str, Any]
    plan: List[Dict[str, Any]]
    current_task_index: int
    task_results: Dict[str, Any]
    final_output: Optional[str]
    status: str

async def execute_coder_task(state: OrchestratorState, task: Dict) -> str:
    """Execute a coding task"""
    prompt = f"""Task: {task['description']}
Context: {json.dumps(state.get('context', {}), indent=2)}
Previous results: {json.dumps(state.get('task_results', {}), indent=2)[:2000]}
Write the code."""
    response = await ollama_client.generate(
        prompt=prompt,
        model="llama3", # Hardcoded to match working state
        system=CODER_SYSTEM,
        temperature=0.3,
    )
    return response.get("response", "")

async def execute_tester_task(state: OrchestratorState, task: Dict) -> str:
    """Execute a testing task"""
    code = state["task_results"].get("coder", "")
    prompt = f"""Write tests for this code:\n{code}"""
    response = await ollama_client.generate(
        prompt=prompt,
        model="llama3",
        system=TESTER_SYSTEM,
        temperature=0.3,
    )
    return response.get("response", "")

async def execute_reviewer_task(state: OrchestratorState, task: Dict) -> str:
    """Execute a review task"""
    code = state["task_results"].get("coder", "")
    prompt = f"""Review this code:\n{code}"""
    response = await ollama_client.generate(
        prompt=prompt,
        model="llama3",
        system=REVIEWER_SYSTEM,
        temperature=0.2,
    )
    return response.get("response", "")

async def execute_refactor_task(state: OrchestratorState, task: Dict) -> str:
    """Execute a refactoring task"""
    code = state["task_results"].get("coder", "")
    prompt = f"""Refactor this code:\n{code}\nTask: {task['description']}"""
    response = await ollama_client.generate(
        prompt=prompt,
        model="llama3",
        system=REFACTOR_SYSTEM,
        temperature=0.3,
    )
    return response.get("response", "")

AGENT_EXECUTORS = {
    "coder": execute_coder_task,
    "tester": execute_tester_task,
    "reviewer": execute_reviewer_task,
    "refactor": execute_refactor_task,
}

async def execute_next_task(state: OrchestratorState) -> OrchestratorState:
    """Execute the next task in the plan"""
    if state["current_task_index"] >= len(state["plan"]):
        state["status"] = "completed"
        return state

    task = state["plan"][state["current_task_index"]]
    agent_type = task.get("agent", "coder")
    executor = AGENT_EXECUTORS.get(agent_type, execute_coder_task)

    # This is where we yield control back to the service for streaming
    state["current_task"] = task
    state["current_agent"] = agent_type
    state["status"] = "executing"
    
    result = await executor(state, task)
    state["task_results"][task["id"]] = result
    state["current_task_index"] += 1
    
    return state

def should_continue(state: OrchestratorState) -> str:
    """Determine if we should continue executing tasks"""
    if state["status"] == "completed" or state["current_task_index"] >= len(state["plan"]):
        return "finalize"
    return "execute"

async def finalize(state: OrchestratorState) -> OrchestratorState:
    """Compile final output from all task results"""
    state["final_output"] = json.dumps(state["task_results"], indent=2)
    state["status"] = "completed"
    return state

def create_orchestrator_graph() -> StateGraph:
    """Create the full multi-agent orchestrator"""
    graph = StateGraph(OrchestratorState)

    # Nodes
    graph.add_node("execute", execute_next_task)
    graph.add_node("finalize", finalize)

    # Edges
    graph.set_entry_point("execute")
    graph.add_conditional_edges(
        "execute",
        should_continue,
        {"execute": "execute", "finalize": "finalize"},
    )
    graph.add_edge("finalize", END)

    return graph.compile()

# Singleton
orchestrator = create_orchestrator_graph()