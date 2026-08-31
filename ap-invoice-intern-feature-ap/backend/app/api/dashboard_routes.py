"""FastAPI routes for Dashboard and Operational Analytics."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.services.dashboard_service import get_dashboard_stats
from app.dashboard.services import (
    get_summary_service,
    get_invoices_service,
    get_invoice_detail_service,
    get_invoice_timeline_service,
    get_analytics_service,
    get_performance_service,
    apply_invoice_filters
)
from app.dashboard.export import serialize_to_csv, serialize_to_excel_html, serialize_to_json

from app.dependencies import get_current_user

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(get_current_user)]
)

@router.get("/stats")
def fetch_dashboard_stats(db: Session = Depends(get_db)):
    """
    Purpose:
        Returns aggregated dashboard statistics computed directly in the database.
        (Preserved for backward compatibility).
    """
    return get_dashboard_stats(db)

@router.get("/summary", response_model=dict)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Returns aggregated summary metrics for total invoices, POs, and spend volumes."""
    return get_summary_service(db)

@router.get("/invoices", response_model=dict)
def get_dashboard_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1),
    sort_by: str = "invoice_date",
    sort_order: str = "desc",
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Provides paginated, filtered lists of processed invoices."""
    invoices, total = get_invoices_service(db, page, page_size, sort_by, sort_order, search, status, date_from, date_to)
    items = []
    for inv in invoices:
        items.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "vendor_name": inv.vendor_name or inv.seller_name,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "total_amount": inv.total_invoice_value or inv.total_amount,
            "status": inv.status,
            "workflow_status": inv.workflow_status.value if inv.workflow_status else None,
            "confidence_score": inv.confidence_score
        })
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/invoice/{invoice_id}", response_model=dict)
def get_invoice_detail(invoice_id: int, db: Session = Depends(get_db)):
    """Retrieves full extraction details for a single invoice."""
    inv = get_invoice_detail_service(db, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "vendor_name": inv.vendor_name or inv.seller_name,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "total_amount": inv.total_invoice_value or inv.total_amount,
        "status": inv.status,
        "workflow_status": inv.workflow_status.value if inv.workflow_status else None,
        "confidence_score": inv.confidence_score,
        "seller_gstin": inv.seller_gstin,
        "buyer_gstin": inv.buyer_gstin,
        "po_number": inv.po_number,
        "validation_status": inv.validation_status,
        "match_status": inv.match_status,
        "match_score": inv.match_score
    }

@router.get("/invoice/{invoice_id}/timeline", response_model=List[dict])
def get_invoice_timeline(invoice_id: int, db: Session = Depends(get_db)):
    """Fetches the state transition history logs trail for an invoice."""
    timeline = get_invoice_timeline_service(db, invoice_id)
    formatted = []
    for item in timeline:
        formatted.append({
            "action": item["action"],
            "status_before": item["status_before"],
            "status_after": item["status_after"],
            "performed_by": item["performed_by"],
            "timestamp": item["timestamp"].isoformat(),
            "details": item["details"]
        })
    return formatted

@router.get("/analytics", response_model=dict)
def get_dashboard_analytics(db: Session = Depends(get_db)):
    """Returns analytics data (monthly spend charts and top vendor spend distributions)."""
    return get_analytics_service(db)

@router.get("/performance", response_model=dict)
def get_dashboard_performance(db: Session = Depends(get_db)):
    """Calculates average processing latencies and confidence pass scores."""
    return get_performance_service(db)

@router.get("/export")
def get_dashboard_export(
    format: str = Query("csv", pattern="^(csv|excel|json)$"),
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Exports matching search datasets to CSV, Excel, or JSON format."""
    query = apply_invoice_filters(db, search, status, date_from, date_to)
    invoices = query.all()
    
    if format == "csv":
        content = serialize_to_csv(invoices)
        media_type = "text/csv"
        filename = "invoices_export.csv"
    elif format == "excel":
        content = serialize_to_excel_html(invoices)
        media_type = "application/vnd.ms-excel"
        filename = "invoices_export.xls"
    else:
        content = serialize_to_json(invoices)
        media_type = "application/json"
        filename = "invoices_export.json"
        
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
