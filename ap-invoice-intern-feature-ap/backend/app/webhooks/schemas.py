"""Canonical Webhook Event Schema."""
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

class WebhookActor(BaseModel):
    id: Optional[str] = None
    role: Optional[str] = None
    name: Optional[str] = None

class CanonicalWebhookEvent(BaseModel):
    """
    The Single Canonical Event Contract.
    All providers (Internal Sandbox, External HTTP, Discord, Email) MUST consume this event structure.
    """
    event_id: str = Field(..., description="Unique ID for this event occurrence")
    event_type: str = Field(..., description="E.g., INVOICE_APPROVED, INVOICE_REJECTED")
    version: str = Field(default="1.0", description="Schema version")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp")
    tenant_id: str = Field(..., description="Organization ID generating the event")
    invoice_id: str = Field(..., description="Related Invoice ID")
    actor: Optional[WebhookActor] = None
    data: Dict[str, Any] = Field(default_factory=dict, description="Event-specific metadata")
