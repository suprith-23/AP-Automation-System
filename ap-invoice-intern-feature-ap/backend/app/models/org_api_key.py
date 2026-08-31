"""
Database model for multi-key, multi-provider pool entries.
Allows hot-swappable key pools with dynamic status and cooldown tracking per organization.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Uuid
from app.core.database import Base


class OrgAPIKey(Base):
    __tablename__ = "org_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Uuid, ForeignKey("organizations.id"), nullable=True, index=True)
    provider_name = Column(String, nullable=False, index=True)  # "groq", "gemini", "nvidia", "colab", etc.
    key_name = Column(String, nullable=False)                    # E.g. "Primary Groq Key #1"
    encrypted_key = Column(String, nullable=False)               # Fernet encrypted API key
    status = Column(String, nullable=False, default="active")    # active | expired | rate_limited
    cooldown_until = Column(DateTime(timezone=True), nullable=True) # Expiry timestamp for 429 reset
    priority_order = Column(Integer, nullable=False, default=10) # Lower = tried first
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(String, nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
