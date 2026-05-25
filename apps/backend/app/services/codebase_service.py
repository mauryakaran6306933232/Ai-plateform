import os
import zipfile
import io
import chromadb
from typing import List, Dict
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class CodebaseService:
    def __init__(self):
        try:
            if settings.effective_chroma_host:
                self.client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
            else:
                import os
                persist_dir = settings.CHROMA_PERSIST_DIR
                os.makedirs(persist_dir, exist_ok=True)
                self.client = chromadb.PersistentClient(path=persist_dir)
        except Exception as e:
            logger.error(f"CodebaseService failed to connect to ChromaDB: {e}")
            self.client = None

    async def process_upload(self, project_id: int, file_bytes: bytes, filename: str) -> Dict:
        """Unzip, chunk, embed, and store a codebase"""
        if not self.client:
            return {"status": "error", "message": "ChromaDB not connected"}

        # 1. Unzip in memory
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                files = []
                for name in z.namelist():
                    if name.endswith("/") or "__pycache__" in name or name.startswith(".") or "node_modules" in name:
                        continue
                    code_extensions = (
                        ".py", ".js", ".ts", ".jsx", ".tsx", ".java",
                        ".cpp", ".h", ".go", ".rs", ".rb", ".php",
                        ".html", ".css", ".sql", ".sh", ".yaml", ".yml",
                        ".json", ".xml", ".md",
                    )
                    if name.lower().endswith(code_extensions):
                        try:
                            content = z.read(name).decode("utf-8", errors="ignore")
                            if content.strip():
                                files.append({"name": name, "content": content})
                        except Exception:
                            continue
        except zipfile.BadZipFile:
            return {"status": "error", "message": "Invalid ZIP file"}

        if not files:
            return {"status": "error", "message": "No supported code files found in the ZIP"}

        # 2. Chunking Strategy
        documents = []
        metadatas = []
        ids = []
        for f in files:
            chunk_id = f"proj_{project_id}_{f['name'].replace('/', '_').replace('.', '_')}"
            content = f["content"][:8000]
            documents.append(f"File: {f['name']}\n\n{content}")
            metadatas.append({"project_id": str(project_id), "filename": f["name"]})
            ids.append(chunk_id)

        # 3. Store in ChromaDB
        try:
            collection_name = f"project_{project_id}"
            collection = self.client.get_or_create_collection(name=collection_name)

            existing_ids = collection.get()["ids"]
            if existing_ids:
                collection.delete(ids=existing_ids)

            collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )

            logger.info(f"Stored {len(documents)} code chunks for project {project_id}")
            return {"status": "success", "files_processed": len(documents), "project_id": project_id}

        except Exception as e:
            logger.error(f"Failed to store embeddings: {e}")
            return {"status": "error", "message": str(e)}

    def search_context(self, project_id: int, query: str, top_k: int = 5) -> List[str]:
        """Search codebase for relevant context"""
        if not self.client:
            return []
        try:
            collection_name = f"project_{project_id}"
            collection = self.client.get_collection(name=collection_name)
            results = collection.query(
                query_texts=[query],
                n_results=top_k,
            )
            if results and results["documents"]:
                return results["documents"][0]
            return []
        except Exception as e:
            logger.warning(f"Codebase search failed: {e}")
            return []


# Singleton
codebase_service = CodebaseService()