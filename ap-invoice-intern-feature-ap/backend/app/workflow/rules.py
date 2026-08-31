"""Workflow Rules Engine for evaluating threshold conditions and routing workflows."""
import logging
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.settings import Settings

logger = logging.getLogger("workflow.rules")

class RulesEngine:
    @staticmethod
    def evaluate_invoice_rules(db: Session, invoice_id: int) -> dict:
        """
        Evaluate invoice properties against rules to recommend next action/routing.
        Returns:
            dict containing:
                "action": "AUTO_APPROVE" | "REQUIRE_APPROVAL" | "HOLD" | "MANUAL_REVIEW"
                "reason": descriptive text
                "assigned_role": recommended role (e.g. "Manager", "VP", "Finance")
        """
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return {"action": "HOLD", "reason": f"Invoice with ID {invoice_id} not found."}

        # 1. Fetch system thresholds and requirements
        settings = db.query(Settings).first()
        min_confidence = settings.ai_confidence_threshold if settings else 0.85
        invoice_total = float(invoice.total_invoice_value or invoice.total_amount or 0.0)

        # 2. Check GST and TDS failure statuses
        # If invoice validation_status failed or validation_errors exist, flag manual review or hold
        if invoice.validation_status == "FAILED":
            return {
                "action": "HOLD",
                "reason": f"Base fields validation failed: {invoice.validation_errors}",
                "assigned_role": "Reviewer"
            }

        # 3. Check PO match status
        if invoice.match_status == "FAILED":
            return {
                "action": "MANUAL_REVIEW",
                "reason": f"PO matching failed with score {invoice.match_score or 0.0}.",
                "assigned_role": "Reviewer"
            }

        # 4. Check confidence scores
        if invoice.confidence_score and invoice.confidence_score < min_confidence:
            return {
                "action": "MANUAL_REVIEW",
                "reason": f"AI confidence score ({invoice.confidence_score}) is below threshold ({min_confidence}).",
                "assigned_role": "Reviewer"
            }

        # 5. Evaluate approval thresholds
        # Standard limits:
        # Amount < 10,000 -> Auto approve (unless settings override)
        # Amount >= 100,000 -> Approver (VP level)
        # Else -> Approver (Manager level)
        if invoice_total < 10000.0:
            if settings is None or not settings.workflow_approver_required:
                return {
                    "action": "AUTO_APPROVE",
                    "reason": f"Invoice total {invoice_total} is under the auto-approval threshold.",
                    "assigned_role": "System"
                }
            else:
                return {
                    "action": "REQUIRE_APPROVAL",
                    "reason": f"Invoice total {invoice_total} is under auto-approval threshold but reviewer/approver required in settings.",
                    "assigned_role": "Approver"
                }
        elif invoice_total >= 100000.0:
            return {
                "action": "REQUIRE_APPROVAL",
                "reason": f"Invoice total {invoice_total} equals or exceeds the VP limit (100,000).",
                "assigned_role": "Approver"
            }
        else:
            return {
                "action": "REQUIRE_APPROVAL",
                "reason": f"Invoice total {invoice_total} requires standard Manager approval.",
                "assigned_role": "Approver"
            }
