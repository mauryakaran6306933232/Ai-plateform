from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from app.services.memory_service import memory_service

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class StoreRequest(BaseModel):
    content: str
    memory_type: str = "fact"  # fact, conversation, preference, procedure
    importance: float = 0.5
    metadata: Optional[dict] = None

class ContextRequest(BaseModel):
    query: str
    max_tokens: int = 2000

@router.post("/search")
async def search_memory(req: SearchRequest):
    """Semantic search through memory using ChromaDB"""
    results = memory_service.search(req.query, n_results=req.top_k)
    return {"query": req.query, "results": results}

@router.post("/store")
async def store_memory(req: StoreRequest):
    """Store a new memory entry"""
    metadata = req.metadata or {}
    metadata["memory_type"] = req.memory_type
    metadata["importance"] = req.importance
    
    doc_id = memory_service.store(req.content, metadata=metadata)
    return {"status": "stored", "memory_type": req.memory_type, "id": doc_id}

@router.post("/context")
async def get_context(req: ContextRequest):
    """Get relevant context for a query (RAG)"""
    results = memory_service.search(req.query, n_results=3)
    context = "\n".join(results) if results else ""
    return {"query": req.query, "context": context, "sources": []}

@router.get("/all")
async def get_all_memories():
    """Get all memories for the UI browser"""
    memories = memory_service.get_all()
    return {"memories": memories}