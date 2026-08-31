"""
Pydantic schemas for OrgAPIKey CRUD API endpoints.
"""

from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class OrgAPIKeyBase(BaseModel):
    provider_name: str
    key_name: str
    api_key: str
    priority_order: int = 10
    enabled: bool = True


class OrgAPIKeyCreate(OrgAPIKeyBase):
    org_id: Optional[UUID] = None


class OrgAPIKeyUpdate(BaseModel):
    key_name: Optional[str] = None
    api_key: Optional[str] = None
    priority_order: Optional[int] = None
    enabled: Optional[bool] = None
    status: Optional[str] = None


class OrgAPIKeyResponse(BaseModel):
    id: int
    org_id: Optional[UUID] = None
    provider_name: str
    key_name: str
    masked_key: str
    status: str
    priority_order: int
    enabled: bool
    last_used_at: Optional[datetime] = None
    last_error: Optional[str] = None
    cooldown_until: Optional[datetime] = None

    class Config:
        from_attributes = True
