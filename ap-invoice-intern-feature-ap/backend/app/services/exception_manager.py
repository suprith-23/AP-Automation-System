"""Exception Management Service."""
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.exception_record import InvoiceException

logger = logging.getLogger("exception.manager")

class ExceptionManager:
    def log_exception(
        self,
        db: Session,
        invoice_id: int,
        exception_type: str,
        error_message: str,
        details: Optional[dict] = None
    ) -> InvoiceException:
        """
        Logs a processing exception and transitions the invoice to EXCEPTION status.
        """
        # Ensure we record the exception
        exc = InvoiceException(
            invoice_id=invoice_id,
            exception_type=exception_type,
            error_message=error_message,
            details=details,
            status="PENDING"
        )
        db.add(exc)

        # Transition invoice status to EXCEPTION
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.status = "EXCEPTION"
            # Log error details into validation_errors column
            if not inv.validation_errors:
                inv.validation_errors = []
            inv.validation_errors = list(inv.validation_errors) + [{
                "stage": exception_type,
                "error": error_message,
                "timestamp": datetime.utcnow().isoformat()
            }]
            
        db.commit()
        db.refresh(exc)
        return exc

    def get_pending_exceptions(self, db: Session) -> List[InvoiceException]:
        """
        Retrieves all unresolved exceptions.
        """
        return db.query(InvoiceException).filter(InvoiceException.status == "PENDING").all()

    def resolve_exception(
        self,
        db: Session,
        exception_id: int,
        resolved_by: str,
        corrections: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Resolves an exception, applies manual edits to the invoice, and updates status.
        """
        exc = db.query(InvoiceException).filter(InvoiceException.id == exception_id).first()
        if not exc:
            raise ValueError(f"Exception with ID {exception_id} not found.")

        exc.status = "RESOLVED"
        exc.resolved_by = resolved_by
        exc.resolved_at = datetime.utcnow()

        inv = db.query(Invoice).filter(Invoice.id == exc.invoice_id).first()
        if inv and corrections:
            # Apply corrections to invoice fields (e.g. buyer_gstin, invoice_number, etc.)
            for key, val in corrections.items():
                if hasattr(inv, key):
                    setattr(inv, key, val)
            # Reset status back to DRAFT or UPLOADED so the orchestrator can re-trigger validations
            inv.status = "UPLOADED"
            inv.validation_status = "pending"
            inv.match_status = "pending"

        db.commit()
        return {
            "exception_id": exception_id,
            "invoice_id": exc.invoice_id,
            "status": "RESOLVED",
            "message": "Exception resolved. Invoice has been queued for reprocessing."
        }
