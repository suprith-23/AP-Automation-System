"""Webhook delivery tracking model for idempotency and delivery logging."""

from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Uuid, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class WebhookDelivery(Base):
    """Database table schema mapping to the 'webhook_deliveries' table."""
    __tablename__ = "webhook_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(String, unique=True, index=True, nullable=False)
    event_id = Column(String, index=True, nullable=False)
    tenant_id = Column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    
    event_type = Column(String, index=True, nullable=False)
    provider = Column(String, nullable=False) # e.g., INTERNAL_SANDBOX
    
    status = Column(String, default="PENDING", index=True, nullable=False) # PENDING, DELIVERED, FAILED
    attempt = Column(Integer, default=1, nullable=False)
    
    payload = Column(JSON, nullable=False)
    response_code = Column(Integer, nullable=True)
    response_body_summary = Column(String, nullable=True)
    
    latency_ms = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
