"""Pydantic schemas for invoice requests and responses."""

from datetime import date, datetime
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.invoice import InvoiceWorkflowStatus


# --- Invoice Item Schemas ---

class InvoiceItemBase(BaseModel):
    """Fields shared by invoice item create and response payloads."""
    # Primary items fields for manual testing
    item_number: Optional[int] = None
    item_barcode: Optional[str] = None
    description: Optional[str] = None
    quantity: float = 0.0
    unit_price: float = 0.0
    total_item_value: float = 0.0
    hsn_code: Optional[str] = None
    gst_rate: float = 0.0
    assessable_value: float = 0.0
    cgst_amount: float = 0.0
    sgst_amount: float = 0.0
    igst_amount: float = 0.0

    # Other item fields
    sl_no: Optional[str] = None
    is_service: str = "N"
    unit: Optional[str] = None
    total_amount: float = 0.0
    discount: float = 0.0
    cess_rate: float = 0.0
    cess_amount: float = 0.0
    cess_non_advalorem_amount: float = 0.0
    state_cess_rate: float = 0.0
    state_cess_amount: float = 0.0
    other_charges: float = 0.0

    @field_validator("item_number", mode="before")
    @classmethod
    def coerce_item_number(cls, v):
        """Coerce item_number to int, returning None for non-numeric strings (e.g. 'Subtotal')."""
        if v is None:
            return None
        try:
            return int(float(str(v).strip()))
        except (ValueError, TypeError):
            return None


class InvoiceItemCreate(InvoiceItemBase):
    """Payload used to create an invoice item."""
    pass


class InvoiceItemResponse(InvoiceItemBase):
    """Invoice item object returned by the API."""
    id: int
    invoice_id: int

    model_config = ConfigDict(from_attributes=True)


# --- Invoice Schemas ---

class InvoiceBase(BaseModel):
    """Fields shared by invoice create and response payloads."""
    # Canonical primary fields for manual testing
    type_of_invoice: str = "TAX_INVOICE"
    po_number: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    seller_name: Optional[str] = None
    seller_gstin: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    shipping_name: Optional[str] = None
    shipping_gstin: Optional[str] = None
    total_taxable_value: float = 0.0
    total_cgst_value: float = 0.0
    total_sgst_value: float = 0.0
    total_igst_value: float = 0.0
    round_off_amount: float = 0.0
    total_invoice_value: float = 0.0

    # Other canonical fields
    irn: Optional[str] = None
    seller_gstin_pincode: int = 0
    buyer_gstin_pincode: int = 0
    shipping_gstin_pincode: int = 0
    total_gst_rate: float = 0.0
    total_ces_value: float = 0.0
    total_st_ces_value: float = 0.0
    total_discount_value: float = 0.0
    total_accessment_value: float = 0.0

    # System fields
    document_id: Optional[int] = None
    workflow_status: Optional[InvoiceWorkflowStatus] = InvoiceWorkflowStatus.validation_pending
    validation_status: str = "pending"
    match_status: str = "pending"
    validation_errors: Optional[Any] = None
    confidence_score: Optional[float] = None
    match_score: Optional[float] = None
    source_type: str = "json_api"
    processed_at: Optional[datetime] = None
    raw_ocr_text: Optional[str] = None
    extracted_json: Optional[Any] = None
    confidence_json: Optional[Any] = None
    extraction_timestamp: Optional[datetime] = None
    organization_id: Optional[UUID] = None
    assigned_reviewer_id: Optional[UUID] = None

    # Backward compatibility
    vendor_name: Optional[str] = None
    due_date: Optional[date] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    status: str = "pending"


class InvoiceCreate(InvoiceBase):
    """Payload used to create an invoice, including optional items."""
    items: Optional[List[InvoiceItemCreate]] = None


class InvoiceUpdate(BaseModel):
    """Payload used to update selected invoice fields."""
    type_of_invoice: Optional[str] = None
    irn: Optional[str] = None
    po_number: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    seller_name: Optional[str] = None
    seller_gstin: Optional[str] = None
    seller_gstin_pincode: Optional[int] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    buyer_gstin_pincode: Optional[int] = None
    shipping_name: Optional[str] = None
    shipping_gstin: Optional[str] = None
    shipping_gstin_pincode: Optional[int] = None
    total_taxable_value: Optional[float] = None
    total_gst_rate: Optional[float] = None
    total_cgst_value: Optional[float] = None
    total_sgst_value: Optional[float] = None
    total_igst_value: Optional[float] = None
    total_ces_value: Optional[float] = None
    total_st_ces_value: Optional[float] = None
    total_discount_value: Optional[float] = None
    round_off_amount: Optional[float] = None
    total_accessment_value: Optional[float] = None
    total_invoice_value: Optional[float] = None
    workflow_status: Optional[InvoiceWorkflowStatus] = None
    validation_status: Optional[str] = None
    match_status: Optional[str] = None
    validation_errors: Optional[Any] = None
    confidence_score: Optional[float] = None
    source_type: Optional[str] = None
    processed_at: Optional[datetime] = None

    # Backward compatibility
    vendor_name: Optional[str] = None
    due_date: Optional[date] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None


class InvoiceResponse(InvoiceBase):
    """Invoice object returned by the API."""
    id: int
    items: List[InvoiceItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class InvoiceSummaryResponse(BaseModel):
    """Lightweight summary response for listing invoices without heavy columns (OCR, JSON, items, validation errors)."""
    id: int
    type_of_invoice: str = "TAX_INVOICE"
    po_number: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    seller_name: Optional[str] = None
    seller_gstin: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    shipping_name: Optional[str] = None
    shipping_gstin: Optional[str] = None
    total_taxable_value: float = 0.0
    total_cgst_value: float = 0.0
    total_sgst_value: float = 0.0
    total_igst_value: float = 0.0
    round_off_amount: float = 0.0
    total_invoice_value: float = 0.0
    document_id: Optional[int] = None
    workflow_status: Optional[InvoiceWorkflowStatus] = InvoiceWorkflowStatus.validation_pending
    validation_status: str = "pending"
    match_status: str = "pending"
    confidence_score: Optional[float] = None
    match_score: Optional[float] = None
    source_type: str = "json_api"
    processed_at: Optional[datetime] = None
    extraction_timestamp: Optional[datetime] = None
    organization_id: Optional[UUID] = None
    assigned_reviewer_id: Optional[UUID] = None

    # Backward compatibility
    vendor_name: Optional[str] = None
    due_date: Optional[date] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    status: str = "pending"

    model_config = ConfigDict(from_attributes=True)
