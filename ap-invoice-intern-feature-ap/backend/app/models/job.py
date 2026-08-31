"""Database model for tracking asynchronous pipeline execution jobs."""
from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from app.core.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    status = Column(String, default="pending", index=True, nullable=False)  # pending, processing, completed, failed
    current_stage = Column(String, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    error_message = Column(String, nullable=True)
    stages_metadata = Column(JSON, default=dict, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True, nullable=False)
