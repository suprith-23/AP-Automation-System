import os
import httpx
from app.ai.providers.base_provider import BaseAIProvider
from app.utils.retry import retry_async

class GroqProvider(BaseAIProvider):
    @property
    def provider_name(self) -> str:
        return "groq"

    @retry_async(retries=3, delay=1.0, backoff=2.0, exceptions=(httpx.HTTPError,))
    async def call_api(self, client: httpx.AsyncClient, final_prompt: str, api_key: str) -> str:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            "messages": [{"role": "user", "content": final_prompt}],
            "temperature": 0.0,
            "response_format": {"type": "json_object"}
        }
        url = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
