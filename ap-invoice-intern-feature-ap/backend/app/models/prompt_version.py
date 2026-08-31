from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime
from app.core.database import Base

class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True, index=True, nullable=False)
    content = Column(Text, nullable=False)
    notes = Column(String, nullable=True)
    author = Column(String, default="Admin", nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
