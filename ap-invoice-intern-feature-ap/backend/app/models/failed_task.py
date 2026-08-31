from sqlalchemy import Column, Integer, String, Text, DateTime, Uuid
from app.core.database import Base
from datetime import datetime

class FailedTask(Base):
    __tablename__ = "failed_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(255), nullable=False)
    organization_id = Column(Uuid, nullable=True, index=True)
    invoice_id = Column(String(255), nullable=True)
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow)
    stack_trace = Column(Text, nullable=True)
