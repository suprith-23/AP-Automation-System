"""SLA Tracking and Verification Engine."""
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.approval import ApprovalRequest, ApprovalHistory
from app.models.payment import PaymentSchedule, PaymentTransaction
from app.core.config import CONFIG

class SLAEngine:
    @staticmethod
    def get_invoice_sla(db: Session, invoice: Invoice) -> Dict[str, Any]:
        """
        Calculate SLA statistics for a specific invoice.
        """
        from app.models.settings import Settings
        settings = db.query(Settings).first()
        grace_period = settings.sla_grace_period_hours if settings else 2
        sla_rules = CONFIG.sla_rules.get("stages", {})

        # 1. Determine Enter Time and Target Duration based on current stage
        wf_status = (invoice.workflow_status.value if invoice.workflow_status else "UPLOADED").upper()
        
        # Map DB workflow status string to configuration key
        rule_key = wf_status
        if wf_status == "VALIDATION_PENDING" or wf_status == "VALIDATION_FAILED":
            rule_key = "UPLOADED"
        elif wf_status == "PENDING_REVIEW":
            rule_key = "VALIDATED"
        elif wf_status == "PENDING_APPROVAL":
            rule_key = "PENDING_APPROVAL"

        rule = sla_rules.get(rule_key, { "max_duration_hours": 24 })
        max_hours = rule.get("max_duration_hours", 24)

        # Enter time of current stage
        enter_time = invoice.extraction_timestamp or datetime.utcnow()
        if wf_status == "PENDING_APPROVAL":
            # entered when approval request was created
            req = db.query(ApprovalRequest).filter(
                ApprovalRequest.invoice_id == invoice.id,
                ApprovalRequest.status.in_(["PENDING", "ESCALATED"])
            ).first()
            if req:
                enter_time = req.created_at

        # Calculate SLA
        elapsed = datetime.utcnow() - enter_time
        elapsed_hours = elapsed.total_seconds() / 3600.0
        remaining_hours = max_hours - elapsed_hours
        overdue = remaining_hours < 0

        # Determine SLA Status
        if overdue:
            # Check if escalated
            req = db.query(ApprovalRequest).filter(
                ApprovalRequest.invoice_id == invoice.id,
                ApprovalRequest.status == "ESCALATED"
            ).first()
            sla_status = "ESCALATED" if req else "BREACHED"
        elif remaining_hours <= grace_period:
            sla_status = "WARNING"
        else:
            sla_status = "COMPLIANT"

        # 2. Extract Stage Durations
        # OCR / AI
        extracted = invoice.extracted_json or {}
        ocr_time = float(extracted.get("ocr_duration_ms", 1200)) / 1000.0
        ai_time = float(extracted.get("llm_duration_ms", 2100)) / 1000.0
        val_time = 0.5 # validation is fast in memory

        # Approval duration (from extraction to approved status)
        approval_time = 0.0
        if invoice.status == "APPROVED" or wf_status == "APPROVED":
            final_approve = db.query(ApprovalHistory).filter(
                ApprovalHistory.invoice_id == invoice.id,
                ApprovalHistory.action.in_(["APPROVE", "AUTO_APPROVE", "OVERRIDE"])
            ).order_by(ApprovalHistory.timestamp.desc()).first()
            if final_approve and invoice.extraction_timestamp:
                approval_time = (final_approve.timestamp - invoice.extraction_timestamp).total_seconds()
        elif invoice.extraction_timestamp:
            approval_time = (datetime.utcnow() - invoice.extraction_timestamp).total_seconds()

        # Payment duration (from approved to paid status)
        payment_time = 0.0
        paid_record = db.query(PaymentTransaction).join(PaymentSchedule).filter(
            PaymentSchedule.invoice_id == invoice.id
        ).first()
        if paid_record and invoice.processed_at:
            payment_time = (paid_record.payment_date - invoice.processed_at).total_seconds()

        return {
            "sla_status": sla_status,
            "remaining_time_hours": round(max(0.0, remaining_hours), 2),
            "overdue": overdue,
            "max_duration_hours": max_hours,
            "elapsed_hours": round(elapsed_hours, 2),
            "durations": {
                "upload_time": (invoice.extraction_timestamp or enter_time).isoformat(),
                "ocr_time_secs": round(ocr_time, 3),
                "ai_time_secs": round(ai_time, 3),
                "validation_time_secs": round(val_time, 3),
                "approval_time_secs": round(approval_time, 2),
                "payment_time_secs": round(payment_time, 2)
            }
        }
