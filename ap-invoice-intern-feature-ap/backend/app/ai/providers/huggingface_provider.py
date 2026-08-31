import os
import httpx
from app.ai.providers.base_provider import BaseAIProvider
from app.utils.retry import retry_async


class HuggingFaceProvider(BaseAIProvider):
    @property
    def provider_name(self) -> str:
        return "huggingface"

    @retry_async(retries=3, delay=1.0, backoff=2.0, exceptions=(httpx.HTTPError,))
    async def call_api(self, client: httpx.AsyncClient, final_prompt: str, api_key: str) -> str:
        model = os.getenv("HF_MODEL", "meta-llama/Llama-3.3-70B-Instruct")
        base_url = os.getenv("HF_API_URL", "https://router.huggingface.co/v1/")

        if "api-inference.huggingface.co/models/" in base_url or base_url.endswith("/models/"):
            url = f"{base_url.rstrip('/')}/{model}/v1/chat/completions"
        elif "chat/completions" in base_url:
            url = base_url
        else:
            url = f"{base_url.rstrip('/')}/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": final_prompt}],
            "temperature": 0.1,
            "max_tokens": 4096,
        }
        # Try with JSON mode first, fall back without it
        try:
            response = await client.post(
                url, headers=headers,
                json={**payload, "response_format": {"type": "json_object"}},
                timeout=60.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 400:
                response = await client.post(url, headers=headers, json=payload, timeout=60.0)
                response.raise_for_status()
            else:
                raise
        data = response.json()
        return data["choices"][0]["message"]["content"]
