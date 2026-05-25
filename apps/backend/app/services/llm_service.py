import os
import json
import time
import asyncio
from typing import AsyncGenerator, Optional, Dict, List
from app.config import get_settings
from app.services.benchmark_service import benchmark_service

settings = get_settings()


class LLMService:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.default_model = settings.OLLAMA_DEFAULT_MODEL
        self.provider = os.environ.get("LLM_PROVIDER", "ollama").lower()
        self.groq_api_key = os.environ.get("GROQ_API_KEY", "")
        self.groq_model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

    def _get_groq_client(self):
        """Lazy-load Groq client"""
        from groq import Groq
        return Groq(api_key=self.groq_api_key)

    async def stream_generate(self, prompt: str, model: str = None) -> AsyncGenerator[str, None]:
        """Stream responses - automatically picks the right provider"""
        if self.provider == "groq" and self.groq_api_key:
            async for chunk in self._stream_groq(prompt, model):
                yield chunk
        else:
            async for chunk in self._stream_ollama(prompt, model):
                yield chunk

    async def _stream_ollama(self, prompt: str, model: str = None) -> AsyncGenerator[str, None]:
        """Stream responses from local Ollama model"""
        import httpx

        model = model or self.default_model
        start_time = time.time()
        token_count = 0

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": True},
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

        duration = time.time() - start_time
        benchmark_service.add_record(model=model, tokens=token_count, duration_sec=duration)

    async def _stream_groq(self, prompt: str, model: str = None) -> AsyncGenerator[str, None]:
        """Stream responses from Groq API (FREE tier)"""
        start_time = time.time()
        token_count = 0
        groq_model = model or self.groq_model

        # Map Ollama model names to Groq model names
        model_mapping = {
            "llama3": "llama-3.1-8b-instant",
            "llama3:8b": "llama-3.1-8b-instant",
            "llama3:70b": "llama-3.1-70b-versatile",
            "llama3.1": "llama-3.1-8b-instant",
            "mixtral": "mixtral-8x7b-32768",
            "gemma2": "gemma2-9b-it",
        }
        groq_model = model_mapping.get(groq_model, groq_model)

        try:
            client = self._get_groq_client()

            # Groq SDK is synchronous, so we run it in a thread
            def _sync_stream():
                chunks = []
                stream = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=groq_model,
                    stream=True,
                    temperature=0.7,
                    max_tokens=4096,
                )
                for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        chunks.append(chunk.choices[0].delta.content)
                return chunks

            chunks = await asyncio.to_thread(_sync_stream)
            for chunk in chunks:
                token_count += 1
                yield chunk

        except Exception as e:
            yield f"\n[Groq Error: {str(e)}]"

        duration = time.time() - start_time
        benchmark_service.add_record(model=groq_model, tokens=token_count, duration_sec=duration)


llm_service = LLMService()