import chromadb
from typing import List, Dict, Optional
from app.config import get_settings
import logging
import os

logger = logging.getLogger(__name__)
settings = get_settings()


class MemoryService:
    def __init__(self):
        self.client = None
        self.collection = None
        try:
            # If CHROMA_HOST is set, use HttpClient (for Docker Compose)
            if settings.effective_chroma_host:
                logger.info(f"[Memory] Connecting to ChromaDB server at {settings.CHROMA_HOST}:{settings.CHROMA_PORT}")
                self.client = chromadb.HttpClient(
                    host=settings.CHROMA_HOST,
                    port=settings.CHROMA_PORT,
                )
            else:
                # Use PersistentClient for cloud deployment (Render, etc.)
                persist_dir = settings.CHROMA_PERSIST_DIR
                # Ensure directory exists
                os.makedirs(persist_dir, exist_ok=True)
                logger.info(f"[Memory] Using PersistentClient at {persist_dir}")
                self.client = chromadb.PersistentClient(path=persist_dir)

            # Initialize collection
            self.collection = self.client.get_or_create_collection(name="jarvis_brain")
            logger.info("[Memory] ChromaDB initialized successfully.")
        except Exception as e:
            logger.error(f"[Memory] Failed to connect to ChromaDB: {e}")

    def store(self, text: str, metadata: dict = None) -> Optional[str]:
        if not self.client or not self.collection:
            return None
        import uuid
        doc_id = str(uuid.uuid4())
        meta = metadata or {"source": "user_input"}

        try:
            self.collection.add(
                documents=[text],
                metadatas=[meta],
                ids=[doc_id],
            )
            logger.info(f"[Memory] Saved: {text[:50]}...")
            return doc_id
        except Exception as e:
            logger.error(f"[Memory] Store failed: {e}")
            return None

    def search(self, query: str, n_results: int = 3) -> List[str]:
        if not self.client or not self.collection:
            return []
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
            )
            if results and results["documents"]:
                logger.info(f"[Memory] Found {len(results['documents'][0])} memories for: {query[:30]}...")
                return results["documents"][0]
            return []
        except Exception as e:
            logger.error(f"[Memory] Search failed: {e}")
            return []

    def get_all(self) -> List[Dict]:
        if not self.client or not self.collection:
            return []
        try:
            results = self.collection.get()
            memories = []
            if results and results["documents"]:
                for i, doc in enumerate(results["documents"]):
                    memories.append({
                        "id": results["ids"][i],
                        "text": doc,
                        "metadata": results["metadatas"][i] if results["metadatas"] else {},
                    })
            return memories
        except Exception as e:
            logger.error(f"[Memory] Get all failed: {e}")
            return []


# Singleton
memory_service = MemoryService()