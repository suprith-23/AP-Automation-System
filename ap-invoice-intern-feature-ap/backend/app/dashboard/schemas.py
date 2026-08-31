"""Pydantic schemas for Dashboard and Analytics data response formatting."""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import date, datetime

class InvoiceSummaryItem(BaseModel):
    id: int
    invoice_number: Optional[str]
    vendor_name: Optional[str]
    invoice_date: Optional[date]
    total_amount: Optional[float]
    status: Optional[str]
    workflow_status: str
    confidence_score: Optional[float]

class DashboardSummary(BaseModel):
    total_invoices: int
    total_spend: float
    review_queue_count: int
    matched_count: int
    match_rate: float
    active_po_volume: float
    active_po_count: int

class TimelineItem(BaseModel):
    action: str
    status_before: Optional[str]
    status_after: Optional[str]
    performed_by: str
    timestamp: datetime
    details: Optional[Dict[str, Any]]
