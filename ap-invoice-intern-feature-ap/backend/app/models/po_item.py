"""PO Item and GRN database models."""
from datetime import date
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, Enum
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class PurchaseOrderItem(Base):
    """Line items for a Purchase Order."""
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    item_number = Column(Integer, nullable=True)
    hsn_code = Column(String, nullable=True)
    description = Column(String, nullable=True)
    quantity = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    tax_rate = Column(Float, default=0.0, nullable=False) # e.g. 0.18 for 18%
    total_amount = Column(Float, default=0.0, nullable=False)

    po = relationship("PurchaseOrder", backref="items")

class GRN(Base):
    """Goods Receipt Note header."""
    __tablename__ = "grns"

    id = Column(Integer, primary_key=True, index=True)
    grn_number = Column(String, unique=True, index=True, nullable=False)
    po_number = Column(String, index=True, nullable=False)
    received_date = Column(Date, nullable=False)
    received_by = Column(String, nullable=True)

class GRNItem(Base):
    """Goods Receipt Note line item."""
    __tablename__ = "grn_items"

    id = Column(Integer, primary_key=True, index=True)
    grn_id = Column(Integer, ForeignKey("grns.id", ondelete="CASCADE"), nullable=False)
    item_number = Column(Integer, nullable=True)
    hsn_code = Column(String, nullable=True)
    quantity_received = Column(Float, default=0.0, nullable=False)
    quantity_accepted = Column(Float, default=0.0, nullable=False)
    quantity_rejected = Column(Float, default=0.0, nullable=False)

    grn = relationship("GRN", backref="items")
