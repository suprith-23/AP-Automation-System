"""Service wrapper for orchestrating Purchase Order matching and database persistence."""
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.matching.engine import MatchingEngine
from app.matching.config import MatchingConfig

logger = logging.getLogger("matching.service")

class POMatchingService:
    def __init__(self, config: Optional[MatchingConfig] = None):
        self.config = config or MatchingConfig()
        self.engine = MatchingEngine(self.config)

    def match_and_persist(self, db: Session, invoice_id: int) -> dict:
        """
        Retrieves the invoice from the database, runs the MatchingEngine,
        persists the matching report/score back to the invoice, and returns the report.
        """
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError(f"Invoice with ID {invoice_id} not found.")

        # Create dictionary payload for matching engine
        invoice_data = {
            "id": invoice.id,
            "po_number": invoice.po_number,
            "seller_gstin": invoice.seller_gstin,
            "vendor_name": invoice.vendor_name or invoice.seller_name,
            "total_amount": invoice.total_invoice_value or invoice.total_amount,
            "currency": invoice.currency,
            "invoice_date": invoice.invoice_date
        }

        # Execute match
        report = self.engine.match(invoice_data, db)

        # Update database fields
        invoice.match_status = report["final_status"]
        invoice.match_score = report["match_score"]
        
        # Link report validation warnings if present
        if report["warnings"]:
            invoice.validation_errors = (invoice.validation_errors or []) + report["warnings"]

        # Determine workflow status transitions
        if report["final_status"] in ["MATCHED", "MATCHED_WITH_WARNING"]:
            invoice.status = "MATCHED"
            if invoice.validation_status == "PASSED":
                invoice.workflow_status = InvoiceWorkflowStatus.pending_approval
            else:
                invoice.workflow_status = InvoiceWorkflowStatus.pending_review
        else:
            invoice.status = "MANUAL_REVIEW"
            invoice.workflow_status = InvoiceWorkflowStatus.validation_failed

        db.commit()
        db.refresh(invoice)

        return report
