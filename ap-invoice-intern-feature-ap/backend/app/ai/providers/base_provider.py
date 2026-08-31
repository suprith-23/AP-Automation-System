import httpx
from abc import ABC, abstractmethod

class BaseAIProvider(ABC):
    """Abstract Base Class for AI semantic extraction models."""
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def call_api(self, client: httpx.AsyncClient, final_prompt: str, api_key: str) -> str:
        """Call the specific provider endpoint."""
        pass
