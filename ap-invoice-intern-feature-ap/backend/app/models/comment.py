from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base

class InvoiceComment(Base):
    """Database model schema for AP Invoice Comments."""
    
    __tablename__ = "invoice_comments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    invoice = relationship("Invoice", foreign_keys=[invoice_id])
    user = relationship("User", foreign_keys=[user_id])
