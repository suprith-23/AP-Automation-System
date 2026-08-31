"""Invoice item database model."""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, BigInteger
from sqlalchemy.orm import relationship

from app.core.database import Base


class InvoiceItem(Base):
    """
    Purpose:
        SQLAlchemy model representing individual line items on an invoice.
    """

    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)

    item_number = Column(BigInteger, nullable=True)
    item_barcode = Column(String, nullable=True)
    sl_no = Column(String, nullable=True)
    is_service = Column(String, default="N", nullable=False)
    description = Column(String, nullable=True)
    hsn_code = Column(String, nullable=True)
    quantity = Column(Float, default=0.0, nullable=False)
    unit = Column(String, nullable=True)
    unit_price = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    discount = Column(Float, default=0.0, nullable=False)
    assessable_value = Column(Float, default=0.0, nullable=False)
    gst_rate = Column(Float, default=0.0, nullable=False)
    igst_amount = Column(Float, default=0.0, nullable=False)
    cgst_amount = Column(Float, default=0.0, nullable=False)
    sgst_amount = Column(Float, default=0.0, nullable=False)
    cess_rate = Column(Float, default=0.0, nullable=False)
    cess_amount = Column(Float, default=0.0, nullable=False)
    cess_non_advalorem_amount = Column(Float, default=0.0, nullable=False)
    state_cess_rate = Column(Float, default=0.0, nullable=False)
    state_cess_amount = Column(Float, default=0.0, nullable=False)
    other_charges = Column(Float, default=0.0, nullable=False)
    total_item_value = Column(Float, default=0.0, nullable=False)

    # Relationship to parent Invoice
    invoice = relationship("Invoice", back_populates="items")
