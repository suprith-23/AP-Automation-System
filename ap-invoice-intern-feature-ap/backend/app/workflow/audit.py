"""Audit trailing for Workflow engine transitions."""
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.workflow.models import WorkflowHistory

logger = logging.getLogger("workflow.audit")

class AuditLogger:
    @staticmethod
    def log_action(
        db: Session,
        invoice_id: int,
        action: str,
        state_before: Optional[str] = None,
        state_after: Optional[str] = None,
        performed_by: str = "system",
        reason: Optional[str] = None,
        metadata_json: Optional[Dict[str, Any]] = None
    ) -> WorkflowHistory:
        """Create an immutable entry in the workflow history audit trail."""
        try:
            entry = WorkflowHistory(
                invoice_id=invoice_id,
                action=action,
                state_before=state_before,
                state_after=state_after,
                performed_by=performed_by,
                reason=reason,
                metadata_json=metadata_json
            )
            db.add(entry)
            db.commit()
            db.refresh(entry)
            logger.info(f"Audit Logged: Invoice {invoice_id} transition [{state_before} -> {state_after}] by {performed_by}.")
            return entry
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to write audit log for Invoice {invoice_id}: {str(e)}")
            raise
