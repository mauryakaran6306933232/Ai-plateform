import chromadb
from typing import List, Dict, Optional
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

class MemoryService:
    def __init__(self):
        self.client = None
        self.collection = None
        try:
            # Use HttpClient if CHROMA_HOST is configured (points to Docker container)
            if settings.CHROMA_HOST:
                logger.info(f"■ [Memory] Connecting to ChromaDB server at {settings.CHROMA_HOST}:{settings.CHROMA_PORT}")
                self.client = chromadb.HttpClient(
                    host=settings.CHROMA_HOST,
                    port=settings.CHROMA_PORT
                )
            else:
                # Fallback to PersistentClient for strictly local dev without Docker
                logger.info(f"■ [Memory] Using local PersistentClient at {settings.CHROMA_PERSIST_DIR}")
                self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            
            # Initialize collection
            self.collection = self.client.get_or_create_collection(name="jarvis_brain")
            logger.info("■ [Memory] ChromaDB initialized successfully.")
        except Exception as e:
            logger.error(f"■■ [Memory] Failed to connect to ChromaDB: {e}")
            # Service will run but memory features will be disabled gracefully

    def store(self, text: str, metadata: dict = None) -> Optional[str]:
        if not self.collection: return None
        import uuid
        doc_id = str(uuid.uuid4())
        meta = metadata or {"source": "user_input"}
        
        self.collection.add(
            documents=[text],
            metadatas=[meta],
            ids=[doc_id]
        )
        logger.info(f"■ [Memory] Saved: {text[:50]}...")
        return doc_id

    def search(self, query: str, n_results: int = 3) -> List[str]:
        if not self.collection: return []
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )
            if results and results['documents']:
                logger.info(f"■ [Memory] Found {len(results['documents'][0])} memories for: {query[:30]}...")
                return results['documents'][0]
        except Exception as e:
            logger.error(f"■■ [Memory] Search failed: {e}")
        return []

    def get_all(self) -> List[Dict]:
        if not self.collection: return []
        try:
            results = self.collection.get()
            memories = []
            if results and results['documents']:
                for i, doc in enumerate(results['documents']):
                    memories.append({
                        "id": results['ids'][i],
                        "text": doc,
                        "metadata": results['metadatas'][i] if results['metadatas'] else {}
                    })
            return memories
        except Exception as e:
            logger.error(f"■■ [Memory] Get all failed: {e}")
            return []

# Singleton
memory_service = MemoryService()