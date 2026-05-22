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
            self.client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
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
                    # Skip directories, hidden files, and common non-code files
                    if name.endswith('/') or '__pycache__' in name or name.startswith('.') or 'node_modules' in name or '.git/' in name:
                        continue
                    
                    # Only process text-based code files
                    code_extensions = ('.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.h', '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.html', '.css', '.sql', '.md', '.yaml', '.json')
                    if name.lower().endswith(code_extensions):
                        try:
                            content = z.read(name).decode('utf-8', errors='ignore')
                            if content.strip(): # Skip empty files
                                files.append({"name": name, "content": content})
                        except Exception:
                            continue # Skip files that can't be read as text
        except zipfile.BadZipFile:
            return {"status": "error", "message": "Invalid ZIP file"}

        if not files:
            return {"status": "error", "message": "No supported code files found in the ZIP"}

        # 2. Chunking Strategy: 1 document per file (can be enhanced to split large files later)
        documents = []
        metadatas = []
        ids = []

        for f in files:
            # Simple chunking: if file > 3000 chars, split by classes/functions roughly
            # For V1, we'll just store the whole file as one document if it's reasonable
            chunk_id = f"proj_{project_id}_{f['name'].replace('/', '_').replace('.', '_')}"
            
            # Truncate extremely large files to prevent Ollama embedding timeouts
            content = f['content'][:8000] 
            
            documents.append(f"File: {f['name']}\n\n{content}")
            metadatas.append({"project_id": str(project_id), "filename": f['name']})
            ids.append(chunk_id)

        # 3. Store in ChromaDB (Let ChromaDB handle embedding using its default model to save compute, or use Ollama)
        # For speed and reliability, we'll use ChromaDB's built-in default embedding for code context
        try:
            collection_name = f"project_{project_id}"
            collection = self.client.get_or_create_collection(name=collection_name)
            
            # Clear existing data for this project to avoid duplicates on re-upload
            existing_ids = collection.get()['ids']
            if existing_ids:
                collection.delete(ids=existing_ids)

            collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
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
                n_results=top_k
            )
            
            if results and results['documents']:
                return results['documents'][0]
        except Exception as e:
            logger.warning(f"Codebase search failed (collection might not exist): {e}")
            return []

# Singleton
codebase_service = CodebaseService()