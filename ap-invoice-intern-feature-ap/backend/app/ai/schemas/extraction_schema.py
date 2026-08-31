"""Response schema for normalized invoice extraction."""

from pydantic import BaseModel
from typing import List, Optional

class ExtractedInvoiceItem(BaseModel):
    """Line item fields extracted by the AI engine."""
    item_number: Optional[int] = None
    item_barcode: Optional[str] = None
    sl_no: Optional[str] = None
    is_service: Optional[str] = None
    description: Optional[str] = None
    hsn_code: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    discount: Optional[float] = None
    assessable_value: Optional[float] = None
    gst_rate: Optional[float] = None
    igst_amount: Optional[float] = None
    cgst_amount: Optional[float] = None
    sgst_amount: Optional[float] = None
    cess_rate: Optional[float] = None
    cess_amount: Optional[float] = None
    cess_non_advalorem_amount: Optional[float] = None
    state_cess_rate: Optional[float] = None
    state_cess_amount: Optional[float] = None
    other_charges: Optional[float] = None
    total_item_value: Optional[float] = None

class ExtractionSchema(BaseModel):
    """Normalized invoice structure returned by the AI extractor."""
    type_of_invoice: Optional[str] = None
    irn: Optional[str] = None
    po_number: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    seller_name: Optional[str] = None
    seller_gstin: Optional[str] = None
    seller_gstin_pincode: Optional[int] = None
    buyer_name: Optional[str] = None
    buyer_gstin: Optional[str] = None
    buyer_gstin_pincode: Optional[int] = None
    shipping_gstin: Optional[str] = None
    shipping_gstin_pincode: Optional[int] = None
    currency: Optional[str] = None
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
    items: List[ExtractedInvoiceItem] = []
