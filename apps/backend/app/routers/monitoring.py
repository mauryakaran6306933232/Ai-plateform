from fastapi import APIRouter, HTTPException
import psutil
import platform
from datetime import datetime
from app.services.metrics_stream_service import metrics_stream_service
from app.config import get_settings
import asyncio
import uuid

router = APIRouter()
settings = get_settings()

# Simple in-memory token counter
token_usage = {
    "input_tokens": 12540,
    "output_tokens": 8420,
    "total_tokens": 20960,
}

START_TIME = datetime.now()

# Mock API Keys Store
mock_api_keys = [
    {"key": "sk-ai-platform-demo-key-12345", "name": "Default Development Key", "created": "2024-01-15"}
]


@router.get("/metrics")
async def get_metrics():
    """Real System metrics from psutil"""
    cpu_percent = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    return {
        "cpu_percent": cpu_percent,
        "memory_percent": mem.percent,
        "memory_used_gb": round(mem.used / (1024**3), 1),
        "memory_total_gb": round(mem.total / (1024**3), 1),
        "disk_percent": psutil.disk_usage("/").percent,
        "platform": platform.system(),
        "python_version": platform.python_version(),
        "uptime_seconds": int((datetime.now() - START_TIME).total_seconds()),
    }


@router.get("/tokens")
async def get_token_usage():
    return token_usage


@router.post("/tokens/update")
async def update_tokens(input_tokens: int = 0, output_tokens: int = 0):
    token_usage["input_tokens"] += input_tokens
    token_usage["output_tokens"] += output_tokens
    token_usage["total_tokens"] += (input_tokens + output_tokens)
    return token_usage


@router.post("/stream/start")
async def start_metrics_stream():
    if not metrics_stream_service.is_running:
        asyncio.create_task(metrics_stream_service.start_system_stream())
        return {"status": "streaming", "message": "System metrics stream started"}
    return {"status": "streaming", "message": "System metrics stream is already running"}


@router.post("/stream/stop")
async def stop_metrics_stream():
    metrics_stream_service.stop_system_stream()
    return {"status": "stopped"}


@router.get("/health")
async def health_check():
    checks = {
        "api": "healthy",
        "database": "connected" if check_db() else "disconnected",
        "redis": "connected" if check_redis() else "disconnected",
        "chromadb": "connected" if check_chroma() else "disconnected",
        "ollama": "healthy" if check_ollama() else "offline",
    }
    return {
        "status": "healthy" if all(v in ("healthy", "connected") for v in checks.values()) else "degraded",
        "checks": checks,
    }


def check_db() -> bool:
    try:
        from app.database import engine
        return True
    except Exception:
        return False


def check_redis() -> bool:
    try:
        import redis
        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            socket_connect_timeout=1,
        )
        return r.ping()
    except Exception:
        return False


def check_chroma() -> bool:
    try:
        import chromadb
        if settings.effective_chroma_host:
            client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
            client.heartbeat()
        else:
            import os
            persist_dir = settings.CHROMA_PERSIST_DIR
            os.makedirs(persist_dir, exist_ok=True)
            client = chromadb.PersistentClient(path=persist_dir)
            client.list_collections()
        return True
    except Exception:
        return False


def check_ollama() -> bool:
    try:
        import httpx
        r = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


@router.get("/ollama/models")
async def get_ollama_models():
    try:
        import httpx
        r = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        if r.status_code == 200:
            models = [m["name"] for m in r.json().get("models", [])]
            return {"models": models, "status": "connected"}
    except Exception:
        pass
    return {"models": [], "status": "offline"}


@router.post("/memory/clear")
async def clear_memory():
    try:
        from app.services.memory_service import memory_service
        from app.database import async_session
        from app.models import Conversation

        conversations_deleted = 0
        async with async_session() as session:
            from sqlalchemy import delete
            result = await session.execute(
                delete(Conversation).where(Conversation.type == "jarvis")
            )
            conversations_deleted = result.rowcount
            await session.commit()

        if memory_service.client:
            collection_name = "jarvis_brain"
            memory_service.client.delete_collection(name=collection_name)
            memory_service.collection = memory_service.client.get_or_create_collection(
                name=collection_name
            )

        return {
            "status": "cleared",
            "message": f"Erased {conversations_deleted} chat histories and all vector memories",
        }
    except Exception as e:
        import traceback
        print(f"Error clearing memory: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}


@router.post("/model/set")
async def set_active_model(data: dict):
    from app.services.model_service import model_service
    model_name = data.get("model")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name required")
    model_service.set_model(model_name)
    return {"status": "success", "active_model": model_name}


@router.get("/model/active")
async def get_active_model():
    from app.services.model_service import model_service
    return {"active_model": model_service.get_model()}


@router.get("/benchmark")
async def get_benchmark_stats():
    from app.services.benchmark_service import benchmark_service
    return benchmark_service.get_stats()


@router.get("/api-keys")
async def get_api_keys():
    return {"keys": mock_api_keys}


@router.post("/api-keys/generate")
async def generate_api_key(data: dict):
    key_name = data.get("name", "Untitled Key")
    new_key = f"sk-ai-platform-{uuid.uuid4().hex[:24]}"
    mock_api_keys.append({
        "key": new_key,
        "name": key_name,
        "created": datetime.now().strftime("%Y-%m-%d"),
    })
    return {"status": "success", "key": new_key}