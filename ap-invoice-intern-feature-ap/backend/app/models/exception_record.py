"""Exception tracking database models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class InvoiceException(Base):
    """Logs of validation, duplicate, TDS, or PO mismatch exceptions requiring manual correction or review."""
    __tablename__ = "invoice_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    exception_type = Column(String, index=True, nullable=False) # e.g. OCR_FAILURE, PO_MISMATCH, TDS_ERROR
    error_message = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    status = Column(String, default="PENDING", nullable=False) # PENDING, RESOLVED, IGNORED
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice")
