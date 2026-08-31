"""Audit log database model."""

from datetime import datetime
from sqlalchemy  import Column, Integer, String, DateTime, JSON, Uuid, ForeignKey
from app.core.database import Base

class AuditLog(Base):
    """
    Purpose:
        SQLAlchemy model representing the 'audit_logs' table in the database.
        This table stores historical records of actions performed on invoices or the system.
    """
    __tablename__="audit_logs"

    # Primary key identifier for the audit log entry
    id = Column(Integer, primary_key=True, index=True)
    # Identifier of the invoice that this audit log is associated with (nullable for general logs)
    invoice_id = Column(Integer, index=True, nullable=True)
    # Organization identifier (nullable for system-wide logs)
    organization_id = Column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    # Name of the action performed (e.g., 'INVOICE_CREATED', 'VALIDATION_COMPLETED')
    action = Column(String, nullable=False)
    # The workflow status of the invoice before the action was performed
    status_before = Column(String, nullable=True)
    # The workflow status of the invoice after the action was performed
    status_after = Column(String, nullable=True)
    # The user role or system agent that performed the action (defaults to 'system')
    performed_by = Column(String, default="system", nullable=False)
    # A JSON field to store additional structured metadata/details about the action
    details = Column(JSON, nullable=True)
    # The UTC timestamp when the action occurred
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

