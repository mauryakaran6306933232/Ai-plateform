import chromadb
from typing import List, Dict, Optional
from ai_core.embeddings.embedding_engine import embedding_engine
from app.config import get_settings

settings = get_settings()


class RAGRetriever:
    """RAG retrieval using ChromaDB + Ollama embeddings"""

    def __init__(self):
        self.client = chromadb.HttpClient(
            host=settings.CHROMA_HOST,
            port=settings.CHROMA_PORT,
        )

    def _get_or_create_collection(self, collection_name: str):
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    async def store_documents(
        self, collection_name: str, documents: List[Dict]
    ) -> int:
        """Store documents with embeddings"""
        collection = self._get_or_create_collection(collection_name)

        texts = [doc["content"] for doc in documents]
        ids = [doc["id"] for doc in documents]
        metadatas = [doc.get("metadata", {}) for doc in documents]

        # Generate embeddings
        embeddings = await embedding_engine.embed_batch(texts)

        # Store in ChromaDB
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )
        return len(documents)

    async def search(
        self, collection_name: str, query: str, top_k: int = 5
    ) -> List[Dict]:
        """Semantic search"""
        collection = self._get_or_create_collection(collection_name)

        # Generate query embedding
        query_embedding = await embedding_engine.embed_query(query)

        # Search
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )

        # Format results
        formatted = []
        if results["documents"]:
            for i, doc in enumerate(results["documents"][0]):
                formatted.append({
                    "content": doc,
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else None,
                    "id": results["ids"][0][i] if results["ids"] else None,
                })
        return formatted

    async def get_context(self, collection_name: str, query: str, max_tokens: int = 2000) -> str:
        """Get relevant context for RAG"""
        results = await self.search(collection_name, query, top_k=5)

        context_parts = []
        total_chars = 0
        max_chars = max_tokens * 4  # approximate

        for result in results:
            content = result["content"]
            if total_chars + len(content) > max_chars:
                break
            context_parts.append(content)
            total_chars += len(content)

        return "\n\n---\n\n".join(context_parts)


# Singleton
rag_retriever = RAGRetriever()