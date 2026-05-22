from fastapi import HTTPException
from app.services.execution_service import execution_service
from pydantic import BaseModel
import os
import base64
import mimetypes
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import FileResponse # NEW

router = APIRouter()

class FileMetadata(BaseModel):
    name: str
    size_kb: float
    last_modified: str

@router.get("/files")
async def list_files():
    """List all files in the AI workspace"""
    files = []
    workspace = execution_service.workspace_dir
    if not os.path.exists(workspace):
        return {"files": []}

    for filename in os.listdir(workspace):
        filepath = os.path.join(workspace, filename)
        if os.path.isfile(filepath):
            stat = os.stat(filepath)
            files.append({
                "name": filename,
                "size_kb": round(stat.st_size / 1024, 2),
                "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })

    files.sort(key=lambda x: x['last_modified'], reverse=True)
    return {"files": files}

@router.get("/files/{filename}")
async def get_file_content(filename: str):
    """Read the content of a specific file (handles text, images, and audio)"""
    filepath = os.path.join(execution_service.workspace_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    # CHECK IF FILE IS AN IMAGE
    image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp')
    if filename.lower().endswith(image_extensions):
        try:
            with open(filepath, "rb") as image_file:
                image_data = image_file.read()

            base64_str = base64.b64encode(image_data).decode('utf-8')
            mime_type, _ = mimetypes.guess_type(filename)
            if not mime_type:
                mime_type = "image/png"

            return {
                "filename": filename,
                "is_image": True,
                "is_audio": False,
                "is_binary": False,
                "mime_type": mime_type,
                "base64": f"data:{mime_type};base64,{base64_str}"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # CHECK IF FILE IS AUDIO
    audio_extensions = ('.mp3', '.wav', '.m4a', '.flac', '.ogg')
    if filename.lower().endswith(audio_extensions):
        return {
            "filename": filename,
            "is_image": False,
            "is_audio": True, # NEW
            "is_binary": False,
            "stream_url": f"/api/workspace/files/{filename}/raw" # NEW: Tell frontend to use raw stream
        }

    # CHECK IF FILE IS OTHER BINARY
    binary_extensions = ('.zip', '.exe', '.dll', '.so', '.pyc')
    if filename.lower().endswith(binary_extensions):
        stat = os.stat(filepath)
        return {
            "filename": filename,
            "is_image": False,
            "is_audio": False,
            "is_binary": True,
            "content": f"[Binary File: {filename} - {round(stat.st_size / 1024, 2)} KB. Cannot display text content.]"
        }

    # OTHERWISE READ AS TEXT
    else:
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return {"filename": filename, "content": content, "is_image": False, "is_audio": False, "is_binary": False}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# NEW: Raw File Streaming Endpoint (For Audio / Video playback)
@router.get("/files/{filename}/raw")
async def get_raw_file(filename: str):
    """Stream raw file for audio/video playback"""
    filepath = os.path.join(execution_service.workspace_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    abs_filepath = os.path.abspath(filepath)
    if not abs_filepath.startswith(execution_service.workspace_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    mime_type, _ = mimetypes.guess_type(filename)
    if not mime_type:
        mime_type = "application/octet-stream"
        
    return FileResponse(abs_filepath, media_type=mime_type)

@router.delete("/files/{filename}")
async def delete_file(filename: str):
    """Delete a file from the workspace"""
    filepath = os.path.join(execution_service.workspace_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    os.remove(filepath)
    return {"status": "deleted", "filename": filename}

class FileUpdate(BaseModel):
    content: str

@router.put("/files/{filename}")
async def update_file_content(filename: str, req: FileUpdate):
    """Update the content of a specific file (In-Browser Editing)"""
    filepath = os.path.join(execution_service.workspace_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": "saved", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))