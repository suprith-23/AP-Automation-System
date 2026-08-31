import os
import httpx
from app.ai.providers.base_provider import BaseAIProvider
from app.utils.retry import retry_async

class GeminiProvider(BaseAIProvider):
    @property
    def provider_name(self) -> str:
        return "gemini"

    @retry_async(retries=3, delay=1.0, backoff=2.0, exceptions=(httpx.HTTPError,))
    async def call_api(self, client: httpx.AsyncClient, final_prompt: str, api_key: str) -> str:
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        base_url = os.getenv("GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta/models/")
        url = f"{base_url}{model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": final_prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0}
        }
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            if "promptFeedback" in data:
                raise httpx.HTTPError(f"Gemini prompt blocked: {data['promptFeedback']}")
            raise httpx.HTTPError(f"Unexpected response structure: {data}")
