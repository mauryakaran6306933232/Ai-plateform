import httpx
import json
import time
import asyncio
from typing import AsyncGenerator, Optional, Dict, List
from app.config import get_settings
from app.services.benchmark_service import benchmark_service # NEW

settings = get_settings()

class LLMService:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.default_model = settings.OLLAMA_DEFAULT_MODEL

    async def stream_generate(self, prompt: str, model: str = None) -> AsyncGenerator[str, None]:
        """Stream responses from local Ollama model and track performance"""
        model = model or self.default_model
        start_time = time.time()
        token_count = 0
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": True}
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            chunk = json.loads(line)
                            if chunk.get("response"):
                                token_count += 1
                                yield chunk["response"]
                            if chunk.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
        
        # NEW: Log Benchmark
        duration = time.time() - start_time
        # Approximate tokens (Ollama chunks are sub-word, assume ~3 chunks per token for rough estimate, or just count chunks)
        # For accurate tracking, we'll use chunks as a proxy for tokens/sec relative speed
        benchmark_service.add_record(model=model, tokens=token_count, duration_sec=duration)

llm_service = LLMService()