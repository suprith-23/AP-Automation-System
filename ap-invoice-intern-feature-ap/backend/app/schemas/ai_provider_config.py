"""Pydantic schemas for AI provider config CRUD."""
from typing import Optional
from pydantic import BaseModel


class AIProviderConfigBase(BaseModel):
    name: str
    api_url: str
    api_key: Optional[str] = ""
    model: Optional[str] = ""
    response_format: str = "openai"   # openai | gemini | colab
    priority: int = 100
    enabled: bool = True


class AIProviderConfigCreate(AIProviderConfigBase):
    pass


class AIProviderConfigUpdate(BaseModel):
    name: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    response_format: Optional[str] = None
    priority: Optional[int] = None
    enabled: Optional[bool] = None


class AIProviderConfigResponse(AIProviderConfigBase):
    id: int
    # Never send back the raw API key to the client — mask it
    api_key: Optional[str] = None   # overridden below

    class Config:
        from_attributes = True

    def model_post_init(self, __context):
        # Mask key: show last 4 chars only, e.g. "••••••••abcd"
        raw = super().__dict__.get("api_key") or ""
        if raw and len(raw) > 4:
            object.__setattr__(self, "api_key", "••••" + raw[-4:])
        elif raw:
            object.__setattr__(self, "api_key", "••••")
        else:
            object.__setattr__(self, "api_key", "")
