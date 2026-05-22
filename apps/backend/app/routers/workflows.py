from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict

router = APIRouter()


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: Optional[int] = None
    agent_config: Optional[Dict] = None
    steps: Optional[List[Dict]] = None


# In-memory store for demo
workflows_db = {}


@router.get("/")
async def list_workflows():
    return {"workflows": list(workflows_db.values())}


@router.post("/")
async def create_workflow(data: WorkflowCreate):
    wf_id = len(workflows_db) + 1
    workflow = {
        "id": wf_id, "name": data.name, "description": data.description,
        "project_id": data.project_id, "status": "created",
        "steps": data.steps or [], "current_step": 0,
    }
    workflows_db[wf_id] = workflow
    return workflow


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: int):
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflows_db[workflow_id]


@router.post("/{workflow_id}/execute")
async def execute_workflow(workflow_id: int):
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    workflows_db[workflow_id]["status"] = "running"
    return {"id": workflow_id, "status": "running"}


@router.get("/{workflow_id}/status")
async def workflow_status(workflow_id: int):
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflows_db[workflow_id]