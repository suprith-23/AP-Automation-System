"""Service module for matching invoices with purchase orders."""
import os
import re
import difflib

from sqlalchemy.orm import Session

from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.invoice import Invoice


# ---------------------------------------------------------------------------
# Configuration (overridable via environment variables)
# ---------------------------------------------------------------------------

def _get_amount_tolerance() -> float:
    """Return the configured PO amount tolerance as a fraction (default 2%)."""
    try:
        return float(os.getenv("PO_AMOUNT_TOLERANCE", "0.02"))
    except ValueError:
        return 0.02


def _get_vendor_name_threshold() -> float:
    """Return the fuzzy vendor-name match threshold (default 0.85)."""
    try:
        return float(os.getenv("PO_VENDOR_NAME_MATCH_THRESHOLD", "0.85"))
    except ValueError:
        return 0.85


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _normalize_name(name: str) -> str:
    """Strip punctuation, collapse whitespace, and uppercase for comparison."""
    name = name.upper()
    name = re.sub(r"[^\w\s]", "", name)   # remove punctuation
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _fuzzy_name_ratio(a: str, b: str) -> float:
    """Return a 0.0–1.0 similarity ratio between two normalized vendor names."""
    return difflib.SequenceMatcher(None, _normalize_name(a), _normalize_name(b)).ratio()


def _get_existing_spend(db: Session, po_number: str) -> float:
    """
    Sum total_invoice_value for all non-rejected, non-pending invoices
    already referencing the given PO number.
    Rejected invoices are excluded from the cumulative spend guard.
    """
    from app.models.invoice import InvoiceWorkflowStatus
    excluded_statuses = {
        InvoiceWorkflowStatus.rejected,
        InvoiceWorkflowStatus.validation_failed,
        InvoiceWorkflowStatus.validation_pending,
    }
    rows = (
        db.query(Invoice.total_invoice_value)
        .filter(
            Invoice.po_number == po_number,
            Invoice.workflow_status.notin_(excluded_statuses),
        )
        .all()
    )
    return sum(r[0] or 0.0 for r in rows)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def match_invoice_to_po(db: Session, invoice_data: dict) -> dict:
    """
    Purpose:
        Validates whether an invoice matches an existing Purchase Order.
        Delegates to the canonical MatchingEngine to ensure Single Source of Truth.
    Inputs:
        - db (Session): The database session.
        - invoice_data (dict): Invoice fields dictionary.
    Outputs:
        - dict: {matched, errors, status, match_score}
    """
    from app.matching.engine import MatchingEngine
    engine = MatchingEngine()
    res = engine.match(invoice_data, db)
    return {
        "matched": res["matched"],
        "errors": res["errors"],
        "status": res["status"],
        "match_score": res.get("match_score_legacy", res.get("match_score", 0.0)),
    }
