"""Core service functions for Dashboard operational queries and analytics."""
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc
from typing import List, Optional, Tuple
from datetime import datetime, date
from app.models.invoice import Invoice
from app.models.audit_log import AuditLog
from app.models.purchase_order import PurchaseOrder
from app.dashboard.metrics import calculate_kpis, get_performance_stats

def get_summary_service(db: Session) -> dict:
    return calculate_kpis(db)

def get_performance_service(db: Session) -> dict:
    return get_performance_stats(db)

def apply_invoice_filters(
    db: Session,
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Applies common filters and search terms to the invoice query."""
    query = db.query(Invoice)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Invoice.invoice_number.ilike(search_term),
                Invoice.vendor_name.ilike(search_term),
                Invoice.seller_name.ilike(search_term),
                Invoice.po_number.ilike(search_term)
            )
        )
        
    if status:
        query = query.filter(Invoice.status.ilike(status))
        
    if date_from:
        try:
            d_from = datetime.strptime(date_from.strip(), "%Y-%m-%d").date()
            query = query.filter(Invoice.invoice_date >= d_from)
        except ValueError:
            pass
            
    if date_to:
        try:
            d_to = datetime.strptime(date_to.strip(), "%Y-%m-%d").date()
            query = query.filter(Invoice.invoice_date <= d_to)
        except ValueError:
            pass
            
    return query

def get_invoices_service(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "invoice_date",
    sort_order: str = "desc",
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
) -> Tuple[List[Invoice], int]:
    """Retrieves paginated invoices list."""
    query = apply_invoice_filters(db, search, status, date_from, date_to)
    
    # Sort mapping
    sort_col = getattr(Invoice, sort_by, Invoice.invoice_date)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))
        
    total_count = query.count()
    offset = (page - 1) * page_size
    invoices = query.offset(offset).limit(page_size).all()
    
    return invoices, total_count

def get_invoice_detail_service(db: Session, invoice_id: int) -> Optional[Invoice]:
    """Retrieves single invoice details."""
    return db.query(Invoice).filter(Invoice.id == invoice_id).first()

def get_invoice_timeline_service(db: Session, invoice_id: int) -> List[dict]:
    """Retrieves timestamped audit trail list for an invoice."""
    logs = db.query(AuditLog).filter(AuditLog.invoice_id == invoice_id).order_by(AuditLog.timestamp.asc()).all()
    return [
        {
            "action": log.action,
            "status_before": log.status_before,
            "status_after": log.status_after,
            "performed_by": log.performed_by,
            "timestamp": log.timestamp,
            "details": log.details
        }
        for log in logs
    ]

def get_analytics_service(db: Session) -> dict:
    """Aggregates dialect-agnostic data for monthly spends and vendor distributions directly in the database."""
    dialect = db.bind.dialect.name
    if dialect == "postgresql":
        # postgresql optimized aggregation
        monthly_stats = db.query(
            func.to_char(Invoice.invoice_date, "YYYY-MM").label("month"),
            func.sum(Invoice.total_invoice_value).label("spend")
        ).filter(Invoice.invoice_date.isnot(None)).group_by(
            func.to_char(Invoice.invoice_date, "YYYY-MM")
        ).all()
    else:
        # sqlite fallback/testing aggregation
        monthly_stats = db.query(
            func.strftime("%Y-%m", Invoice.invoice_date).label("month"),
            func.sum(Invoice.total_invoice_value).label("spend")
        ).filter(Invoice.invoice_date.isnot(None)).group_by(
            func.strftime("%Y-%m", Invoice.invoice_date)
        ).all()

    monthly_spend = [{"month": row.month, "spend": round(float(row.spend or 0.0), 2)} for row in sorted(monthly_stats, key=lambda x: x.month or "")]

    # Vendor spend distribution aggregated on the database side
    vendor_stats = db.query(
        func.coalesce(Invoice.vendor_name, Invoice.seller_name, "Unknown Vendor").label("vendor"),
        func.sum(Invoice.total_invoice_value).label("spend")
    ).group_by(
        func.coalesce(Invoice.vendor_name, Invoice.seller_name, "Unknown Vendor")
    ).order_by(
        func.sum(Invoice.total_invoice_value).desc()
    ).limit(10).all()

    vendor_spend = [{"vendor": row.vendor, "spend": round(float(row.spend or 0.0), 2)} for row in vendor_stats]

    return {
        "monthly_spend": monthly_spend,
        "vendor_spend": vendor_spend
    }
