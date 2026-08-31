"""TDS database models."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class TDSSection(Base):
    """Configuration for a TDS section (e.g. 194C, 194J)."""
    __tablename__ = "tds_sections"

    id = Column(Integer, primary_key=True, index=True)
    section_code = Column(String, unique=True, index=True, nullable=False) # e.g. "194C"
    description = Column(String, nullable=True)
    rate_with_pan = Column(Float, nullable=False) # e.g. 0.01 for 1%
    rate_without_pan = Column(Float, default=0.20, nullable=False) # default 20%
    single_threshold = Column(Float, default=30000.0, nullable=False)
    aggregate_threshold = Column(Float, default=100000.0, nullable=False)

class TDSLedgerEntry(Base):
    """Immutable log of TDS deductions calculated."""
    __tablename__ = "tds_ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    vendor_gstin = Column(String, index=True, nullable=True)
    vendor_pan = Column(String, index=True, nullable=True)
    section_code = Column(String, nullable=False)
    taxable_amount = Column(Float, nullable=False)
    tds_rate = Column(Float, nullable=False)
    tds_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice")


class TDSRule(Base):
    """Configuration for TDS calculation rules, DB-backed and organization-scoped."""
    __tablename__ = "tds_rules"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    section_code = Column(String, index=True, nullable=False) # e.g. "194C"
    description = Column(String, nullable=True)
    rate_with_pan = Column(Float, nullable=False) # e.g. 1.0 for 1%
    rate_without_pan = Column(Float, default=20.0, nullable=False) # default 20%
    single_threshold = Column(Float, default=30000.0, nullable=False)
    aggregate_threshold = Column(Float, default=100000.0, nullable=False)
    vendor_categories = Column(String, nullable=True) # JSON array serialized as string, e.g. '["Contractor"]'
    expense_categories = Column(String, nullable=True) # JSON array serialized as string, e.g. '["Operations"]'
    effective_from = Column(String, nullable=True) # e.g. "2026-04-01"
    effective_to = Column(String, nullable=True) # e.g. "2027-03-31"

    organization = relationship("Organization")

