"""
UniversalProvider
=================
A single class that can talk to ANY AI provider by just configuring:
  - api_url      : the endpoint URL
  - api_key      : bearer token (or empty for open endpoints)
  - model        : model identifier sent in the request body
  - response_fmt : how to parse the response

Supported response_format values
---------------------------------
  "openai"  — OpenAI-compatible /chat/completions  (Groq, NVIDIA NIM, HuggingFace
               Router, Together AI, Fireworks, Anyscale, Perplexity, Mistral, ...)
  "gemini"  — Google Generative Language API format
  "colab"   — Custom /generate or /v1/chat/completions endpoint
               (remote Colab, vLLM, Ollama, llama.cpp server, ...)

Adding a new provider from the frontend:
  Supply name + api_url + api_key + model + response_format.  Done.
  No code change required anywhere.
"""
import httpx
import logging
from typing import Optional
from app.ai.providers.base_provider import BaseAIProvider
from app.utils.retry import retry_async

logger = logging.getLogger("ai.universal_provider")


class ProviderConfig:
    """Lightweight config object — no ORM dependency."""
    def __init__(
        self,
        name: str,
        api_url: str,
        api_key: str = "",
        model: str = "",
        response_format: str = "openai",
    ):
        self.name = name
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.response_format = response_format.lower()


class UniversalProvider(BaseAIProvider):
    """One class. Every provider."""

    def __init__(self, config: ProviderConfig):
        self.config = config

    @property
    def provider_name(self) -> str:
        return self.config.name

    @retry_async(retries=2, delay=1.0, backoff=2.0, exceptions=(httpx.HTTPError,), retry_on_429=False)
    async def call_api(
        self,
        client: httpx.AsyncClient,
        final_prompt: str,
        api_key: str = "",           # passed dynamically from active key pool
        timeout: Optional[httpx.Timeout] = None,
    ) -> str:
        # Use provided active pool key, falling back to config key
        effective_key = api_key or self.config.api_key
        fmt = self.config.response_format
        prov = self.provider_name.lower()
        
        try:
            if fmt == "gemini":
                res = await self._call_gemini(client, final_prompt, effective_key, timeout)
            elif fmt == "colab":
                res = await self._call_colab(client, final_prompt, effective_key, timeout)
            else:
                # Default: OpenAI-compatible (covers Groq, NVIDIA, HF, Together, etc.)
                res = await self._call_openai_compat(client, final_prompt, effective_key, timeout)
            
            from app.core.metrics import LLM_API_CALL
            LLM_API_CALL.labels(provider=prov, status="success").inc()
            return res
        except Exception as e:
            from app.core.metrics import LLM_API_CALL
            LLM_API_CALL.labels(provider=prov, status="failure").inc()
            raise e


    # ------------------------------------------------------------------
    # OpenAI-compatible  (POST /chat/completions)
    # ------------------------------------------------------------------
    async def _call_openai_compat(self, client: httpx.AsyncClient, prompt: str, api_key: str = "", timeout: Optional[httpx.Timeout] = None) -> str:
        url = self.config.api_url
        # Auto-append /chat/completions if URL looks like a base URL
        if not any(url.endswith(s) for s in ["/completions", "/generate", "/generateContent"]):
            if not url.endswith("/chat/completions"):
                url = f"{url}/chat/completions"

        key = api_key or self.config.api_key
        headers = {"Content-Type": "application/json"}
        if key:
            headers["Authorization"] = f"Bearer {key}"

        payload: dict = {
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
        }
        if self.config.model:
            payload["model"] = self.config.model

        timeout_config = timeout or httpx.Timeout(90.0, connect=10.0, read=90.0)

        # Try with JSON mode first
        try:
            resp = await client.post(
                url, headers=headers,
                json={**payload, "response_format": {"type": "json_object"}},
                timeout=timeout_config,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (400, 422):
                # Provider doesn't support response_format — retry without it
                resp = await client.post(url, headers=headers, json=payload, timeout=timeout_config)
                resp.raise_for_status()
            else:
                raise

        data = resp.json()
        return data["choices"][0]["message"]["content"]

    # ------------------------------------------------------------------
    # Google Gemini  (POST /models/<model>:generateContent?key=...)
    # ------------------------------------------------------------------
    async def _call_gemini(self, client: httpx.AsyncClient, prompt: str, api_key: str = "", timeout: Optional[httpx.Timeout] = None) -> str:
        model = self.config.model or "gemini-2.5-flash"
        base = self.config.api_url
        key = api_key or self.config.api_key
        # Allow both bare base URL and full URL with model already in it
        if ":generateContent" not in base:
            base = base.rstrip("/")
            if not base.endswith(model):
                base = f"{base}/{model}"
            url = f"{base}:generateContent?key={key}"
        else:
            # Full URL already contains model + action — just add key
            url = f"{base}?key={key}" if "key=" not in base else base

        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.0},
        }
        timeout_config = timeout or httpx.Timeout(90.0, connect=10.0, read=90.0)
        resp = await client.post(url, headers=headers, json=payload, timeout=timeout_config)
        resp.raise_for_status()
        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            if "promptFeedback" in data:
                raise httpx.HTTPError(f"Gemini prompt blocked: {data['promptFeedback']}")
            raise httpx.HTTPError(f"Unexpected Gemini response: {data}")

    # ------------------------------------------------------------------
    # Remote Colab / vLLM / Ollama / llama.cpp  (/generate or /chat)
    # ------------------------------------------------------------------
    async def _call_colab(self, client: httpx.AsyncClient, prompt: str, api_key: str = "", timeout: Optional[httpx.Timeout] = None) -> str:
        url = self.config.api_url
        key = api_key or self.config.api_key
        if not any(url.endswith(s) for s in ["/generate", "/chat/completions"]):
            url = f"{url}/generate"

        headers: dict = {"Content-Type": "application/json", "ngrok-skip-browser-warning": "true"}
        if key:
            headers["Authorization"] = f"Bearer {key}"

        payload = {
            "prompt": prompt,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0,
        }
        if self.config.model:
            payload["model"] = self.config.model

        # Specific 185-second read timeout for Qwen inference on complex invoice prompts
        colab_timeout = timeout or httpx.Timeout(180.0, connect=15.0, read=180.0)
        resp = await client.post(url, headers=headers, json=payload, timeout=colab_timeout)
        resp.raise_for_status()
        data = resp.json()

        # Accept multiple response shapes
        if "text" in data:
            val = data["text"]
            return val[0] if isinstance(val, list) else str(val)
        if "choices" in data:
            return data["choices"][0]["message"]["content"]
        if "response" in data:
            return data["response"]
        raise httpx.HTTPError(f"Unrecognised colab response shape: {list(data.keys())}")
