from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Project, ProjectFile
from pydantic import BaseModel
from typing import Optional, List
import chromadb
from app.config import get_settings
import logging
import asyncio
import shutil
import os
from app.services.execution_service import execution_service
from app.services.github_service import github_service

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    repo_url: Optional[str] = None
    language: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    repo_url: Optional[str]
    language: Optional[str]
    status: str
    file_count: int
    line_count: int
    class Config:
        from_attributes = True

class CreatePRRequest(BaseModel):
    filename: str
    branch_name: str = "ai-platform/patch"
    commit_message: str = "feat: AI-generated code implementation"
    pr_title: str = "AI Platform: Automated Code Patch"

@router.get("/")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    return {"projects": [
        {
            "id": p.id, "name": p.name, "description": p.description,
            "status": p.status, "language": p.language,
            "file_count": p.file_count, "line_count": p.line_count,
            "repo_url": p.repo_url
        }
        for p in projects
    ]}

@router.post("/")
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(
        name=data.name, description=data.description,
        repo_url=data.repo_url, language=data.language,
    )
    db.add(project)
    await db.flush()
    return {"id": project.id, "name": project.name, "status": project.status}

@router.get("/{project_id}")
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "id": project.id, "name": project.name, "description": project.description,
        "status": project.status, "language": project.language,
        "file_count": project.file_count, "line_count": project.line_count,
        "metadata": project.metadata_,
    }

# ==========================================
# NEW: DELETE PROJECT ENDPOINT
# ==========================================
@router.delete("/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a project from the database and its ChromaDB vector memory"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 1. Delete ChromaDB Collection (Vector Memory)
    try:
        client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
        collection_name = f"project_{project_id}"
        client.delete_collection(name=collection_name)
        logger.info(f"Deleted ChromaDB collection for project {project_id}")
    except Exception as e:
        logger.warning(f"Failed to delete ChromaDB collection for project {project_id} (may not exist): {e}")
    
    # 2. Delete Project Files from DB
    files_result = await db.execute(select(ProjectFile).where(ProjectFile.project_id == project_id))
    files = files_result.scalars().all()
    for f in files:
        await db.delete(f)
        
    # 3. Delete Project Record
    await db.delete(project)
    await db.commit()
    
    return {"status": "deleted", "project_id": project_id, "message": "Project and vector memory deleted successfully"}

@router.post("/upload")
async def upload_project(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are supported")

    project_name = file.filename.replace('.zip', '')
    project = Project(name=project_name, status="analyzing", language="auto-detect")
    db.add(project)
    await db.flush()
    await db.commit()
    await db.refresh(project)

    file_bytes = await file.read()
    asyncio.create_task(process_codebase_async(project.id, file_bytes, file.filename))

    return {
        "id": project.id,
        "name": project.name,
        "status": "analyzing",
        "file_count": 0,
        "message": "Repository uploaded. Embedding codebase into vector memory..."
    }

async def process_codebase_async(project_id: int, file_bytes: bytes, filename: str):
    from app.services.codebase_service import codebase_service
    from app.database import async_session

    async with async_session() as session:
        try:
            result = await codebase_service.process_upload(project_id, file_bytes, filename)
            project = await session.get(Project, project_id)
            if project:
                if result["status"] == "success":
                    project.status = "analyzed"
                    project.file_count = result.get("files_processed", 0)
                    project.language = "multi"
                else:
                    project.status = "error"
                await session.commit()
        except Exception as e:
            logger.error(f"Background processing failed: {e}")
            project = await session.get(Project, project_id)
            if project:
                project.status = "error"
                await session.commit()

@router.post("/upload/simple")
async def upload_project_simple(file: UploadFile = File(...)):
    return {
        "status": "uploaded",
        "filename": file.filename,
        "message": "Repository uploaded.",
    }

@router.post("/github")
async def github_clone(data: dict, db: AsyncSession = Depends(get_db)):
    repo_url = data.get("repo_url")
    if not repo_url or "github.com" not in repo_url:
        raise HTTPException(status_code=400, detail="Valid GitHub URL required")
    repo_name = repo_url.split("/")[-1].replace(".git", "")
    project = Project(name=repo_name, status="analyzing", language="auto-detect", repo_url=repo_url)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    asyncio.create_task(process_github_async(project.id, repo_url))

    return {
        "id": project.id,
        "name": project.name,
        "status": "analyzing",
        "message": "Cloning repository and embedding codebase into vector memory..."
    }

async def process_github_async(project_id: int, repo_url: str):
    from app.database import async_session
    from app.models import Project
    repo_dir = None
    try:
        repo_dir = await github_service.clone_repo(repo_url)
        await asyncio.to_thread(_process_repo_sync, project_id, repo_dir)
    except Exception as e:
        logger.error(f"GitHub processing failed: {e}")
        async with async_session() as session:
            project = await session.get(Project, project_id)
            if project:
                project.status = "error"
                await session.commit()
    finally:
        if repo_dir and os.path.exists(repo_dir):
            shutil.rmtree(repo_dir, ignore_errors=True)

def _process_repo_sync(project_id: int, repo_dir: str):
    try:
        files = []
        code_extensions = ('.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.h', '.go', '.rs', '.rb', '.php', '.html', '.css')
        for root, dirs, filenames in os.walk(repo_dir):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv', '.git']]
            for filename in filenames:
                if filename.lower().endswith(code_extensions):
                    filepath = os.path.join(root, filename)
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                        if content.strip():
                            rel_path = os.path.relpath(filepath, repo_dir)
                            files.append({"name": rel_path, "content": content})
                    except Exception:
                        continue
        if not files:
            raise Exception("No supported code files found in the repository")
            
        documents = []
        metadatas = []
        ids = []
        for f in files:
            chunk_id = f"proj_{project_id}_{f['name'].replace('/', '_').replace('.', '_')}"
            content = f['content'][:8000]
            documents.append(f"File: {f['name']}\n\n{content}")
            metadatas.append({"project_id": str(project_id), "filename": f['name']})
            ids.append(chunk_id)

        collection_name = f"project_{project_id}"
        client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
        collection = client.get_or_create_collection(name=collection_name)
        existing_ids = collection.get()['ids']
        if existing_ids:
            collection.delete(ids=existing_ids)

        collection.add(documents=documents, metadatas=metadatas, ids=ids)
        logger.info(f"Successfully embedded {len(files)} files from GitHub for project {project_id}")
        asyncio.create_task(_update_project_status(project_id, "analyzed", len(files)))
    except Exception as e:
        logger.error(f"Sync processing failed: {e}")
        asyncio.create_task(_update_project_status(project_id, "error", 0))

async def _update_project_status(project_id: int, status: str, file_count: int):
    from app.database import async_session
    from app.models import Project
    async with async_session() as session:
        project = await session.get(Project, project_id)
        if project:
            project.status = status
            project.file_count = file_count
            project.language = "multi"
            await session.commit()

@router.post("/{project_id}/pr")
async def create_pull_request(project_id: int, req: CreatePRRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.repo_url:
        raise HTTPException(status_code=400, detail="Project is not linked to a GitHub repository")
    filepath = os.path.join(execution_service.workspace_dir, req.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found in workspace")
    with open(filepath, "r", encoding="utf-8") as f:
        file_content = f.read()
    try:
        pr_result = await github_service.create_pull_request(
            repo_url=project.repo_url,
            branch_name=req.branch_name,
            file_path=req.filename,
            file_content=file_content,
            commit_message=req.commit_message,
            pr_title=req.pr_title,
            pr_body=f"Automated code generation by AI Platform.\n\nFile Modified: `{req.filename}`"
        )
        return {
            "status": "success",
            "pr_url": pr_result.get("html_url", ""),
            "message": "Pull Request created successfully!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/analyze")
async def analyze_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.status = "analyzing"
    return {"id": project.id, "status": "analyzing", "message": "Analysis started"}

class SearchRequest(BaseModel):
    query: str

@router.post("/{project_id}/search")
async def search_project(project_id: int, req: SearchRequest):
    try:
        client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
        collection = client.get_or_create_collection(name=f"project_{project_id}")
        results = collection.query(query_texts=[req.query], n_results=5)
        formatted = []
        if results and results['documents']:
            for i, doc in enumerate(results['documents'][0]):
                formatted.append({
                    "content": doc,
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "distance": results['distances'][0][i] if results['distances'] else None,
                })
        return {"project_id": project_id, "query": req.query, "results": formatted}
    except Exception as e:
        return {"project_id": project_id, "query": req.query, "results": [], "error": f"Search unavailable: {str(e)}"}