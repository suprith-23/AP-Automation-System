"""Invoice database model."""

import enum
from sqlalchemy import Column, Integer, BigInteger, String, Enum as SqlAlchemyEnum, Float, Date, JSON, DateTime, Uuid, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.user import User


# --- Define Workflow Enum ---
class InvoiceWorkflowStatus(str, enum.Enum):
    """Detailed stages of the Invoice processing workflow."""
    validation_pending = "validation_pending"
    validation_failed = "validation_failed"
    pending_review = "pending_review"
    pending_approval = "pending_approval"
    approved = "approved"
    rejected = "rejected"
    released_for_payment = "released_for_payment"
    paid = "paid"
    payment_queue = "payment_queue"
    scheduled = "scheduled"
    payment_processing = "payment_processing"
    payment_completed = "payment_completed"


class Invoice(Base):
    """Database table schema mapping to the 'invoices' table."""

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, nullable=True)

    # --- New Canonical Invoice Schema Columns ---
    type_of_invoice = Column(String, default="TAX_INVOICE", nullable=False)
    irn = Column(String, nullable=True)
    irn_verification_status = Column(String, nullable=True)
    irn_verification_message = Column(String, nullable=True)
    irn_verified_at = Column(DateTime, nullable=True)
    irn_reference_id = Column(String, nullable=True)
    po_number = Column(String, index=True, nullable=True)
    invoice_number = Column(String, index=True, nullable=True)
    invoice_date = Column(Date, index=True, nullable=True)
    seller_name = Column(String, nullable=True)
    seller_gstin = Column(String, index=True, nullable=True)
    seller_gstin_pincode = Column(BigInteger, default=0, nullable=False)
    buyer_name = Column(String, nullable=True)
    buyer_gstin = Column(String, index=True, nullable=True)
    buyer_gstin_pincode = Column(BigInteger, default=0, nullable=False)
    shipping_name = Column(String, nullable=True)
    shipping_gstin = Column(String, index=True, nullable=True)
 
    shipping_gstin_pincode = Column(BigInteger, default=0, nullable=False)
    total_taxable_value = Column(Float, default=0.0, nullable=False)
    total_gst_rate = Column(Float, default=0.0, nullable=False)
    total_cgst_value = Column(Float, default=0.0, nullable=False)
    total_sgst_value = Column(Float, default=0.0, nullable=False)
    total_igst_value = Column(Float, default=0.0, nullable=False)
    total_ces_value = Column(Float, default=0.0, nullable=False)
    total_st_ces_value = Column(Float, default=0.0, nullable=False)
    total_discount_value = Column(Float, default=0.0, nullable=False)
    round_off_amount = Column(Float, default=0.0, nullable=False)
    total_accessment_value = Column(Float, default=0.0, nullable=False)
    total_invoice_value = Column(Float, default=0.0, nullable=False)
 
    # --- System/Workflow fields ---
    workflow_status = Column(
        SqlAlchemyEnum(InvoiceWorkflowStatus),
        default=InvoiceWorkflowStatus.validation_pending,
        index=True,
        nullable=False
    )
    validation_status = Column(String, default="pending", index=True, nullable=False)
    match_status = Column(String, default="pending", index=True, nullable=False)
    validation_errors = Column(JSON, nullable=True)
    confidence_score = Column(Float, index=True, nullable=True)
    match_score = Column(Float, nullable=True)
    source_type = Column(String, default="json_api", nullable=False)
    processed_at = Column(DateTime, index=True, nullable=True)
    raw_ocr_text = Column(String, nullable=True)
    extracted_json = Column(JSON, nullable=True)
    confidence_json = Column(JSON, nullable=True)
    extraction_timestamp = Column(DateTime, index=True, nullable=True)

    # --- Backward Compatibility Fields (Retained) ---
    vendor_name = Column(String, nullable=True)
    due_date = Column(Date, nullable=True)
    subtotal = Column(Float, nullable=True)
    tax_amount = Column(Float, nullable=True)
    total_amount = Column(Float, nullable=True)
    currency = Column(String, nullable=True)
    status = Column(String, default="pending") 

    # --- Vendor Bank Details ---
    bank_account_number = Column(String, nullable=True)
    ifsc_code = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)

    reviewer_checklist_completed = Column(JSON, default=lambda: {}, nullable=False)
    reviewer_confidence_before = Column(Float, nullable=True)
    reviewer_confidence_after = Column(Float, nullable=True)
    review_duration_seconds = Column(Integer, default=0, nullable=False)

    # --- Queue Assignment (Phase 3) ---
    # Reviewer explicitly assigned to this invoice by an Admin.
    # NULL = unassigned (visible to all Reviewers in org queue).
    assigned_reviewer_id = Column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_at = Column(DateTime, nullable=True)

    # --- Tenant Isolation ---
    organization_id = Column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)

    # --- Relationships ---
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    assigned_reviewer = relationship("User", foreign_keys=[assigned_reviewer_id], lazy="select")

    __table_args__ = (
        UniqueConstraint('organization_id', 'seller_gstin', 'invoice_number', name='uix_tenant_vendor_invoice'),
    )