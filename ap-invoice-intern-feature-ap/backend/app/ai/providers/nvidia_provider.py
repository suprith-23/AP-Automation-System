import os
import httpx
from app.ai.providers.base_provider import BaseAIProvider
from app.utils.retry import retry_async


class NvidiaProvider(BaseAIProvider):
    @property
    def provider_name(self) -> str:
        return "nvidia"

    @retry_async(retries=3, delay=1.0, backoff=2.0, exceptions=(httpx.HTTPError,))
    async def call_api(self, client: httpx.AsyncClient, final_prompt: str, api_key: str) -> str:
        model = os.getenv("NVIDIA_MODEL", "deepseek-ai/deepseek-v3")
        url = os.getenv("NVIDIA_API_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": final_prompt}],
            "temperature": 0.0,
            "max_tokens": 4096,
            "response_format": {"type": "json_object"},
        }
        response = await client.post(url, headers=headers, json=payload, timeout=60.0)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
