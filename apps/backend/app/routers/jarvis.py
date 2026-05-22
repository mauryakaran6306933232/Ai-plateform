from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from app.services.jarvis_service import jarvis_service
from app.services.scheduler_service import scheduler_service
import os # NEW

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None
    mode: Optional[str] = "default"

@router.post("/chat")
async def jarvis_chat(req: ChatRequest, background_tasks: BackgroundTasks):
    """Start a Jarvis chat stream via WebSocket"""
    background_tasks.add_task(jarvis_service.chat_stream, req.message, mode=req.mode)
    return {"status": "processing", "message": "Jarvis is thinking...", "mode": req.mode}

@router.get("/history")
async def get_chat_history(db = None):
    return {"conversations": []}

@router.post("/save")
async def save_conversation(req: dict):
    return {"status": "saved"}

@router.get("/memory")
async def get_memory():
    from app.services.memory_service import memory_service
    return {"memories": memory_service.get_all()}

@router.get("/routines")
async def get_routines():
    return {"routines": scheduler_service.get_jobs()}

@router.delete("/routines/{job_id}")
async def cancel_routine(job_id: str):
    success = scheduler_service.remove_job(job_id)
    if success:
        return {"status": "cancelled", "job_id": job_id}
    return {"status": "not_found", "job_id": job_id}

# ==========================================
# NEW: JARVIS FILE UPLOAD ENDPOINT
# ==========================================
@router.post("/upload-file")
async def jarvis_upload_file(file: UploadFile = File(...)):
    """Upload a file from the Jarvis chat interface to the AI workspace"""
    from app.services.execution_service import execution_service
    
    # Validate extension
    allowed_extensions = ('.pdf', '.zip', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.wav', '.m4a', '.txt', '.py', '.js', '.csv')
    if not file.filename.lower().endswith(allowed_extensions):
        return {"error": f"File type not supported. Allowed: {', '.join(allowed_extensions)}"}
        
    try:
        filepath = os.path.join(execution_service.workspace_dir, file.filename)
        with open(filepath, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            
        return {
            "status": "uploaded", 
            "filename": file.filename,
            "message": f"File {file.filename} saved to workspace successfully."
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}