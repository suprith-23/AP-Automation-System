"""Approval engine database models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base

class ApprovalRule(Base):
    """Configuration rules for invoice approval routing."""
    __tablename__ = "approval_rules"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    department = Column(String, nullable=True) # e.g. "Finance", "HR"
    cost_center = Column(String, nullable=True)
    min_amount = Column(Float, default=0.0, nullable=False)
    max_amount = Column(Float, nullable=True)
    auto_approve = Column(Float, nullable=True) # auto approve below this amount
    approvers = Column(JSON, nullable=False) # List of roles/users in order, e.g. ["Manager", "VP"]
    sla_hours = Column(Integer, default=48, nullable=False)

class ApprovalRequest(Base):
    """An active multi-level approval request for a specific invoice."""
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    current_level = Column(Integer, default=1, nullable=False) # 1-indexed level index
    status = Column(String, default="PENDING", nullable=False) # PENDING, APPROVED, REJECTED, ESCALATED
    assigned_role = Column(String, nullable=False) # Current approver role
    assigned_user_id = Column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sla_deadline = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice")
    user = relationship("User")
    actions = relationship("WorkflowApprovalAction", back_populates="request", cascade="all, delete-orphan")

class ApprovalHistory(Base):
    """Audit records of individual approval decisions."""
    __tablename__ = "approval_histories"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    level = Column(Integer, nullable=False)
    actor = Column(String, nullable=False)
    actor_id = Column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False) # APPROVE, REJECT, ESCALATE, OVERRIDE
    role = Column(String, nullable=True)
    previous_status = Column(String, nullable=True)
    current_status = Column(String, nullable=True)
    rejection_reason = Column(String, nullable=True)
    comments = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice")
