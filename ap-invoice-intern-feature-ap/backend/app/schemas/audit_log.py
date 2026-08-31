"""Pydantic schemas for audit log response payloads."""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict


from uuid import UUID

class AuditLogBase(BaseModel):
    """
    Purpose:
        Base schema containing common fields for audit logs.
    """
    invoice_id: Optional[int] = None
    organization_id: Optional[UUID] = None
    action: str
    status_before: Optional[str] = None
    status_after: Optional[str] = None
    performed_by: str = "system"
    details: Optional[Any] = None


class AuditLogCreate(AuditLogBase):
    """
    Purpose:
        Schema representing fields required to create an audit log entry.
    """
    pass


class AuditLogResponse(AuditLogBase):
    """
    Purpose:
        Schema representing an audit log entry returned in API responses.
    """
    id: int
    timestamp: datetime

    # Enable from_attributes config to serialize SQLAlchemy model instances
    model_config = ConfigDict(from_attributes=True)
