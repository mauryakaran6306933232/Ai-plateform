import httpx
import json
import asyncio
from typing import AsyncGenerator, Optional, Dict, List
from app.config import get_settings

settings = get_settings()


class OllamaClient:
    """Async client for Ollama local LLM inference"""

    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.default_model = settings.OLLAMA_DEFAULT_MODEL

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        system: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> Dict:
        """Generate a completion"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            payload = {
                "model": model or self.default_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            }
            if system:
                payload["system"] = system

            response = await client.post(
                f"{self.base_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    async def generate_stream(
        self,
        prompt: str,
        model: Optional[str] = None,
        system: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Stream a completion"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            payload = {
                "model": model or self.default_model,
                "prompt": prompt,
                "stream": True,
                "options": {"temperature": temperature},
            }
            if system:
                payload["system"] = system

            async with client.stream(
                "POST", f"{self.base_url}/api/generate", json=payload
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "response" in data:
                            yield data["response"]

    async def chat(
        self,
        messages: List[Dict],
        model: Optional[str] = None,
        temperature: float = 0.7,
    ) -> Dict:
        """Chat completion"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            payload = {
                "model": model or self.default_model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature},
            }
            response = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    async def list_models(self) -> List[Dict]:
        """List available models"""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            return response.json().get("models", [])

    async def is_healthy(self) -> bool:
        """Check if Ollama is running"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self.base_url)
                return response.status_code == 200
        except Exception:
            return False


# Singleton
ollama_client = OllamaClient()