# from typing import Dict, List, Any, TypedDict
# from langgraph.graph import StateGraph, END
# from ai_core.llm.ollama_client import ollama_client

# PLANNER_SYSTEM_PROMPT = """You are a Planner Agent for a software engineering system.

# Your job is to:
# 1. Understand the user's request
# 2. Break it down into concrete sub-tasks
# 3. Assign each sub-task to the appropriate agent
# 4. Define dependencies between tasks
# 5. Estimate complexity and priority

# Available agents:
# - coder: Writes, modifies, and creates code files
# - tester: Creates and runs tests
# - reviewer: Performs code review and security audit
# - refactor: Optimizes and refactors existing code

# Output your plan as a JSON array of tasks:
# [
#   {
#     "id": "task_1",
#     "agent": "coder",
#     "description": "What to do",
#     "dependencies": [],
#     "priority": "high|medium|low",
#     "files": ["path/to/file.py"]
#   }
# ]

# IMPORTANT: Output ONLY valid JSON. No markdown. No explanation."""


# class PlannerState(TypedDict):
#     request: str
#     context: Dict[str, Any]
#     plan: List[Dict[str, Any]]
#     current_task_index: int
#     results: List[Dict[str, Any]]
#     errors: List[str]


# async def plan_task(state: PlannerState) -> PlannerState:
#     """Generate a plan from the user request"""
#     prompt = f"""User Request: {state['request']}

# Context: {state.get('context', {})}

# Create a detailed task plan."""

#     response = await ollama_client.generate(
#         prompt=prompt,
#         model="deepseek-coder",
#         system=PLANNER_SYSTEM_PROMPT,
#         temperature=0.3,
#     )

#     # Parse the plan
#     import json
#     try:
#         plan_text = response.get("response", "[]")
#         # Try to extract JSON from the response
#         if "```json" in plan_text:
#             plan_text = plan_text.split("```json")[1].split("```")[0]
#         elif "```" in plan_text:
#             plan_text = plan_text.split("```")[1].split("```")[0]
#         plan = json.loads(plan_text.strip())
#     except (json.JSONDecodeError, IndexError):
#         plan = [
#             {
#                 "id": "task_1",
#                 "agent": "coder",
#                 "description": state["request"],
#                 "dependencies": [],
#                 "priority": "high",
#             }
#         ]

#     state["plan"] = plan
#     state["current_task_index"] = 0
#     state["results"] = []
#     state["errors"] = []
#     return state


# def create_planner_graph() -> StateGraph:
#     """Create the planner agent graph"""
#     graph = StateGraph(PlannerState)

#     # Nodes
#     graph.add_node("plan", plan_task)

#     # Edges
#     graph.set_entry_point("plan")
#     graph.add_edge("plan", END)

#     return graph.compile()


# # Singleton
# planner_agent = create_planner_graph()
from typing import Dict, List, Any, TypedDict
from langgraph.graph import StateGraph, END
from ai_core.llm.ollama_client import ollama_client

PLANNER_SYSTEM_PROMPT = """You are a Planner Agent for a software engineering system.
Your job is to:
1. Understand the user's request
2. Break it down into concrete sub-tasks
3. Assign each sub-task to the appropriate agent
4. Define dependencies between tasks
5. Estimate complexity and priority

Available agents:
- coder: Writes, modifies, and creates code files
- tester: Creates and runs tests
- reviewer: Performs code review and security audit
- refactor: Optimizes and refactors existing code

Output your plan as a JSON array of tasks:
[
  {
    "id": "task_1",
    "agent": "coder",
    "description": "What to do",
    "dependencies": [],
    "priority": "high|medium|low",
    "files": ["path/to/file.py"]
  }
]

IMPORTANT: Output ONLY valid JSON. No markdown. No explanation."""

class PlannerState(TypedDict):
    request: str
    context: Dict[str, Any]
    plan: List[Dict[str, Any]]
    current_task_index: int
    results: List[Dict[str, Any]]
    errors: List[str]

async def plan_task(state: PlannerState) -> PlannerState:
    """Generate a plan from the user request"""
    prompt = f"""User Request: {state['request']}
Context: {state.get('context', {})}

Create a detailed task plan."""

    response = await ollama_client.generate(
        prompt=prompt,
        model="llama3",  # ■ FIXED: Hardcoded to match working state
        system=PLANNER_SYSTEM_PROMPT,
        temperature=0.3,
    )

    # Parse the plan
    import json
    try:
        plan_text = response.get("response", "[]")
        # Try to extract JSON from the response
        if "```json" in plan_text:
            plan_text = plan_text.split("```json")[1].split("```")[0]
        elif "```" in plan_text:
            plan_text = plan_text.split("```")[1].split("```")[0]
        plan = json.loads(plan_text.strip())
    except (json.JSONDecodeError, IndexError):
        plan = [
            {
                "id": "task_1",
                "agent": "coder",
                "description": state["request"],
                "dependencies": [],
                "priority": "high",
            }
        ]

    state["plan"] = plan
    state["current_task_index"] = 0
    state["results"] = []
    state["errors"] = []
    return state

def create_planner_graph() -> StateGraph:
    """Create the planner agent graph"""
    graph = StateGraph(PlannerState)

    # Nodes
    graph.add_node("plan", plan_task)

    # Edges
    graph.set_entry_point("plan")
    graph.add_edge("plan", END)

    return graph.compile()

# Singleton
planner_agent = create_planner_graph()