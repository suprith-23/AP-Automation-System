"""Database model for dynamically configured AI providers.

Each row = one AI provider. Can be added/edited/deleted from the admin UI
or via the API. No code change required to add a new provider.

response_format options:
  - "openai"  — OpenAI-compatible chat completions (Groq, NVIDIA, HF, Together, Fireworks, ...)
  - "gemini"  — Google Generative AI format
  - "colab"   — Custom remote Colab / vLLM /generate endpoint
"""
from sqlalchemy import Column, Integer, String, Boolean, Float
from app.core.database import Base


class AIProviderConfig(Base):
    __tablename__ = "ai_provider_configs"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String, nullable=False)          # Display name, e.g. "My Groq"
    api_url        = Column(String, nullable=False)          # Full endpoint URL
    api_key        = Column(String, nullable=True, default="")  # Bearer token (blank for open endpoints)
    model          = Column(String, nullable=True, default="")  # Model name sent in the request body
    response_format = Column(String, nullable=False, default="openai")  # openai | gemini | colab
    priority       = Column(Integer, nullable=False, default=100)  # Lower = tried first
    enabled        = Column(Boolean, nullable=False, default=True)
