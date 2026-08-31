"""Pydantic schemas for purchase order payloads."""

from datetime import date

from pydantic import BaseModel, ConfigDict


class PurchaseOrderBase(BaseModel):
    """Fields shared across purchase order payloads."""

    po_number: str
    vendor_name: str
    vendor_gstin: str | None = None
    po_amount: float
    po_date: date
    status: str = "open"


class PurchaseOrderCreate(PurchaseOrderBase):
    """Payload used to create a purchase order."""

    pass


class PurchaseOrderUpdate(PurchaseOrderBase):
    """Purpose: Schema defining parameters that can be updated on a purchase order.
    Inputs:
      - po_number: str (Optional new unique identifier)
      - vendor_name: str (Optional new vendor name)
      - vendor_gstin: str (Optional new vendor GSTIN)
      - po_amount: float (Optional new total cost)
      - po_date: date (Optional new issuance date)
      - status: str (Optional new state of the order: open, approved, closed)
    Outputs:
      - Validation of updated fields.
    """

    po_number:str | None=None
    vendor_name:str | None=None
    vendor_gstin:str | None=None
    po_amount:float | None = None
    po_date:date | None=None
    status:str | None=None


class PurchaseOrderResponse(PurchaseOrderBase):
    """Purchase order object returned by the API."""

    id: int

    model_config = ConfigDict(from_attributes=True)
