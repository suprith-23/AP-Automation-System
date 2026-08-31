"""Database models for the Workflow Engine."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from app.core.database import Base

class WorkflowInstance(Base):
    """Tracks active and historical workflow execution instances for invoices."""
    __tablename__ = "workflow_instances"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    current_state = Column(String, default="DRAFT", nullable=False)
    previous_state = Column(String, nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    metadata_json = Column(JSON, nullable=True)  # renamed from metadata to avoid SQLAlchemy namespace clash

    invoice = relationship("Invoice")
    states = relationship("WorkflowState", back_populates="instance", cascade="all, delete-orphan")

class WorkflowState(Base):
    """Tracks execution stages and their individual status for a workflow instance."""
    __tablename__ = "workflow_states"

    id = Column(Integer, primary_key=True, index=True)
    instance_id = Column(Integer, ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    state_name = Column(String, nullable=False)
    status = Column(String, default="PENDING", nullable=False)  # PENDING, RUNNING, COMPLETED, FAILED, ON_HOLD
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    instance = relationship("WorkflowInstance", back_populates="states")

class WorkflowHistory(Base):
    """Tracks immutable state transition history and logs for auditing."""
    __tablename__ = "workflow_history"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    action = Column(String, nullable=False)
    state_before = Column(String, nullable=True)
    state_after = Column(String, nullable=True)
    performed_by = Column(String, default="system", nullable=False)
    reason = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice")

class WorkflowEvent(Base):
    """Log of system generated events within the workflow lifecycle."""
    __tablename__ = "workflow_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)  # e.g., InvoiceReceived, OCRCompleted
    invoice_id = Column(Integer, nullable=False, index=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

from app.models.approval import ApprovalRequest as WorkflowApprovalRequest

class WorkflowApprovalAction(Base):
    """Audit trails of individual approval actions taken (approve/reject/delegate)."""
    __tablename__ = "approval_actions"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("approval_requests.id", ondelete="CASCADE"), nullable=False)
    actor = Column(String, nullable=False)  # username/role or system
    action = Column(String, nullable=False)  # APPROVE, REJECT, DELEGATE, REASSIGN, OVERRIDE
    reason = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    request = relationship("ApprovalRequest", back_populates="actions")

class SLARecord(Base):
    """SLA timer records for invoices."""
    __tablename__ = "sla_records"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    sla_type = Column(String, nullable=False)  # PROCESSING, APPROVAL, ERP_SYNC, PAYMENT
    deadline = Column(DateTime, nullable=False)
    breached = Column(Boolean, default=False, nullable=False)
    breached_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    invoice = relationship("Invoice")
    escalations = relationship("EscalationRecord", back_populates="sla_record", cascade="all, delete-orphan")

class EscalationRecord(Base):
    """Escalation trails when SLAs are breached."""
    __tablename__ = "escalations"

    id = Column(Integer, primary_key=True, index=True)
    sla_record_id = Column(Integer, ForeignKey("sla_records.id", ondelete="CASCADE"), nullable=False)
    level = Column(Integer, default=1, nullable=False)
    original_assignee = Column(String, nullable=True)
    escalated_assignee = Column(String, nullable=True)
    status = Column(String, default="PENDING", nullable=False)  # PENDING, RESOLVED
    triggered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    sla_record = relationship("SLARecord", back_populates="escalations")
