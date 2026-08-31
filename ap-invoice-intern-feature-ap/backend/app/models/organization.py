import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Uuid
from app.core.database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    gst_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    status = Column(String, default="Active", nullable=False)  # "Active", "Suspended", "Deleted"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String, nullable=True)
    admin_assigned = Column(String, nullable=True)
