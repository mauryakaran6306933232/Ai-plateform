import httpx
import json
from typing import List, Optional
from app.config import get_settings

settings = get_settings()


class EmbeddingEngine:
    """Generate embeddings using Ollama's embedding API"""

    def __init__(self, base_url: str = None, model: str = "nomic-embed-text"):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model = model

    async def embed(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
            )
            response.raise_for_status()
            return response.json()["embedding"]

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        embeddings = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            for text in texts:
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model, "prompt": text},
                )
                response.raise_for_status()
                embeddings.append(response.json()["embedding"])
        return embeddings

    async def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a search query"""
        return await self.embed(query)


# Singleton
embedding_engine = EmbeddingEngine()