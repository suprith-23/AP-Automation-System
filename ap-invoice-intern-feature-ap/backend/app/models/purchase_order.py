"""Purchase order database model."""

import enum

from sqlalchemy import Column, Date, Enum, Float, Integer, String, Uuid, ForeignKey

from app.core.database import Base


class PurchaseOrderStatus(str, enum.Enum):
    """Allowed states for a purchase order."""

    open = "open"
    approved = "approved"
    closed = "closed"


class PurchaseOrder(Base):
    """Database table for purchase orders."""

    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)

    po_number = Column(
        String,
        unique=True,
        nullable=False
    )

    vendor_name = Column(
        String,
        nullable=False
    )
    vendor_gstin = Column(
        String,
        index=True,
        nullable=True
    )


    po_amount = Column(
        Float,
        nullable=False
    )

    po_date = Column(
        Date,
        nullable=False
    )

    status = Column(
        Enum(PurchaseOrderStatus),
        default=PurchaseOrderStatus.open
    )

    # --- Tenant Isolation ---
    organization_id = Column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
