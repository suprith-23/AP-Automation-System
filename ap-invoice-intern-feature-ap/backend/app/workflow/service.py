"""Workflow and State machine service for orchestrating invoice lifecycles."""
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.models.audit_log import AuditLog
from app.workflow.config import WorkflowConfig
from app.workflow.notifications import NotificationService, ConsoleNotificationService

logger = logging.getLogger("workflow.service")

def get_transitions() -> dict:
    from app.core.config import CONFIG
    return CONFIG.workflow_rules.get("transitions", {})

def get_current_state(invoice: Invoice) -> str:
    transitions = get_transitions()
    status_str = (invoice.status or "").strip().upper()
    if status_str in transitions:
        return status_str
    # Safe defaults for non-synchronized fields
    return "RECEIVED"

class WorkflowService:
    def __init__(self, config: Optional[WorkflowConfig] = None, notifier: Optional[NotificationService] = None):
        self.config = config or WorkflowConfig()
        if notifier:
            self.notifier = notifier
        else:
            from app.workflow.notifications import EmailNotificationService, SMSNotificationService
            class CompositeNotifier(NotificationService):
                def __init__(self):
                    self.notifiers = [
                        ConsoleNotificationService(),
                        EmailNotificationService(),
                        SMSNotificationService()
                    ]
                def send_notification(self, invoice_id: int, message: str, level: str = "info") -> None:
                    for n in self.notifiers:
                        n.send_notification(invoice_id, message, level)
            self.notifier = CompositeNotifier()

    def _log_audit(self, db: Session, invoice_id: int, action: str, before: str, after: str, actor: str, details: dict):
        log_entry = AuditLog(
            invoice_id=invoice_id,
            action=action,
            status_before=before,
            status_after=after,
            performed_by=actor,
            details=details
        )
        db.add(log_entry)
        db.commit()

    def transition_to(self, db: Session, invoice_id: int, target_state: str, actor: str = "system", reason: Optional[str] = None) -> dict:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError(f"Invoice with ID {invoice_id} not found.")
            
        current_state = get_current_state(invoice)
        target_state = target_state.upper()
        
        transitions = get_transitions()
        if target_state not in transitions:
            raise ValueError(f"State '{target_state}' is not a valid workflow state.")

        # Check FSM transitions
        valid_targets = transitions.get(current_state, [])
        if target_state not in valid_targets and target_state != current_state:
            raise ValueError(f"Invalid state transition from '{current_state}' to '{target_state}'.")
            
        invoice.status = target_state
        
        # Synchronize workflow status
        if target_state == "RELEASED_FOR_PAYMENT":
            invoice.workflow_status = InvoiceWorkflowStatus.released_for_payment
        elif target_state == "PAID":
            invoice.workflow_status = InvoiceWorkflowStatus.paid
        elif target_state in ["APPROVED", "ERP_SYNC_PENDING", "ERP_SYNCED", "PAYMENT_PENDING", "ARCHIVED"]:
            invoice.workflow_status = InvoiceWorkflowStatus.approved
        elif target_state in ["REJECTED", "CANCELLED"]:
            invoice.workflow_status = InvoiceWorkflowStatus.rejected
        elif target_state in ["VALIDATED", "MANUAL_REVIEW", "EXCEPTION", "GST_VERIFIED", "TDS_VERIFIED"]:
            invoice.workflow_status = InvoiceWorkflowStatus.pending_review
        elif target_state in ["DRAFT", "UPLOADED", "EXTRACTED", "OCR_COMPLETED", "AI_EXTRACTED", "RECEIVED", "INGESTED"]:
            invoice.workflow_status = InvoiceWorkflowStatus.validation_pending
        elif target_state in ["MATCHED", "PO_MATCHED", "READY_FOR_PAYMENT", "PENDING_APPROVAL", "ESCALATED", "ON_HOLD", "READY_FOR_APPROVAL", "UNDER_REVIEW"]:
            invoice.workflow_status = InvoiceWorkflowStatus.pending_approval
        elif target_state == "FAILED":
            invoice.workflow_status = InvoiceWorkflowStatus.validation_failed
            
        db.commit()
        db.refresh(invoice)
        
        # Record to audit trail
        self._log_audit(
            db, 
            invoice_id, 
            action=f"TRANSITION_{target_state}", 
            before=current_state, 
            after=target_state, 
            actor=actor, 
            details={"reason": reason or ""}
        )
        
        # Send Notification
        self.notifier.send_notification(
            invoice_id, 
            f"Invoice transition from {current_state} to {target_state} completed by {actor}.", 
            level="info"
        )
        
        return {
            "invoice_id": invoice.id,
            "previous_state": current_state,
            "new_state": target_state,
            "success": True
        }

    def evaluate_auto_approval(self, db: Session, invoice_id: int) -> bool:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return False

        # Read thresholds and rules from Settings DB if available
        try:
            from app.models.settings import Settings as SettingsModel
            settings_row = db.query(SettingsModel).first()
            min_confidence = settings_row.ai_confidence_threshold if settings_row else self.config.min_extraction_confidence
            reviewer_required = settings_row.workflow_reviewer_required if settings_row else True
            approver_required = settings_row.workflow_approver_required if settings_row else True
        except Exception:
            min_confidence = self.config.min_extraction_confidence
            reviewer_required = True
            approver_required = True

        confidence = invoice.confidence_score or 0.0
        match_passed = (invoice.match_status == "MATCHED" or (invoice.match_score and invoice.match_score >= self.config.min_match_score))
        val_passed = (invoice.validation_status == "PASSED")
        conf_passed = (confidence >= min_confidence)

        # If neither reviewer nor approver is required, auto-approve directly
        if not reviewer_required and not approver_required and val_passed and conf_passed:
            self.transition_to(db, invoice_id, "APPROVED", actor="system", reason="Auto-approved: both reviewer and approver steps disabled in settings.")
            return True

        if val_passed and match_passed and conf_passed:
            self.transition_to(db, invoice_id, "APPROVED", actor="system", reason="Auto-approved by Workflow Engine.")
            return True
        else:
            self.transition_to(db, invoice_id, "MANUAL_REVIEW", actor="system", reason="Validation or match criteria did not meet thresholds.")
            return False

    def approve(self, db: Session, invoice_id: int, actor: str = "system", reason: Optional[str] = None) -> dict:
        return self.transition_to(db, invoice_id, "APPROVED", actor=actor, reason=reason)
        
    def reject(self, db: Session, invoice_id: int, actor: str = "system", reason: Optional[str] = None) -> dict:
        return self.transition_to(db, invoice_id, "REJECTED", actor=actor, reason=reason)
        
    def send_to_review(self, db: Session, invoice_id: int, actor: str = "system", reason: Optional[str] = None) -> dict:
        return self.transition_to(db, invoice_id, "MANUAL_REVIEW", actor=actor, reason=reason)
        
    def get_history(self, db: Session, invoice_id: int) -> List[dict]:
        logs = db.query(AuditLog).filter(AuditLog.invoice_id == invoice_id).order_by(AuditLog.timestamp.asc()).all()
        return [
            {
                "id": log.id,
                "invoice_id": log.invoice_id,
                "action": log.action,
                "status_before": log.status_before,
                "status_after": log.status_after,
                "performed_by": log.performed_by,
                "details": log.details,
                "timestamp": log.timestamp.isoformat()
            }
            for log in logs
        ]
