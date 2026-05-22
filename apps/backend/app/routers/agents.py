from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from app.services.agent_service import agent_service
from app.services.execution_service import execution_service
import os

router = APIRouter()

class ExecuteRequest(BaseModel):
    task: str
    context: Optional[dict] = None

class RunFileRequest(BaseModel):
    filename: str

# 🚀 NEW: Request body for fixing code
class FixCodeRequest(BaseModel):
    filename: str
    error_output: str

@router.post("/{agent_id}/execute")
async def execute_agent(agent_id: str, req: ExecuteRequest, background_tasks: BackgroundTasks):
    print(f"■■■ [Router] Received execute request for: {req.task}") # 🚀 DEBUG PRINT
    if agent_id not in ["planner", "coder", "reviewer", "full_stack"]:
        raise HTTPException(status_code=404, detail="Agent not found")
    background_tasks.add_task(agent_service.run_workflow, req.task)
    return {"agent_id": agent_id, "status": "started", "task": req.task}

@router.post("/run-file")
async def run_file(req: RunFileRequest, background_tasks: BackgroundTasks):
    secure_path = os.path.join(execution_service.workspace_dir, req.filename)
    if not os.path.exists(secure_path):
        raise HTTPException(status_code=404, detail="File not found in workspace")
    task_id = req.filename.replace(".py", "")
    background_tasks.add_task(execution_service.execute_file, secure_path, task_id)
    return {"status": "execution_started", "filename": req.filename}

# 🚀 NEW: The Auto-Fix endpoint
@router.post("/fix-code")
async def fix_code(req: FixCodeRequest, background_tasks: BackgroundTasks):
    secure_path = os.path.join(execution_service.workspace_dir, req.filename)
    if not os.path.exists(secure_path):
        raise HTTPException(status_code=404, detail="File not found in workspace")
    
    background_tasks.add_task(agent_service.fix_code, req.filename, req.error_output)
    return {"status": "fix_started", "filename": req.filename}

@router.get("/")
async def list_agents():
    return {
        "agents": [
            {"id": "full_stack", "name": "Full Stack Engineer", "type": "multi-agent"},
            {"id": "planner", "name": "Planner", "type": "planner"},
            {"id": "coder", "name": "Coder", "type": "coder"},
            {"id": "reviewer", "name": "Reviewer", "type": "reviewer"}
        ]
    }