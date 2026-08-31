"""Workflow Manager coordinating lifecycle startup, manual interventions, rules routing, and recovery."""
import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.workflow.models import WorkflowInstance, WorkflowApprovalRequest, SLARecord
from app.workflow.state_machine import WorkflowState as WState
from app.workflow.engine import WorkflowEngine
from app.workflow.rules import RulesEngine
from app.workflow.approval import ApprovalSystem
from app.workflow.sla import SLAMonitor
from app.workflow.exceptions import WorkflowException

logger = logging.getLogger("workflow.manager")

class WorkflowManager:
    def __init__(self):
        self.engine = WorkflowEngine()

    def start_workflow(self, db: Session, invoice_id: int) -> dict:
        """Kicks off the invoice lifecycle."""
        # 1. Initialize instance
        self.engine.get_or_create_instance(db, invoice_id)
        # 2. Transition from DRAFT to RECEIVED
        return self.engine.transition_to(db, invoice_id, WState.RECEIVED, actor="system", reason="Workflow started.")

    def advance_workflow(self, db: Session, invoice_id: int, target_state: str, actor: str = "system", reason: str = None) -> dict:
        """Forced advance state transition."""
        return self.engine.transition_to(db, invoice_id, target_state, actor=actor, reason=reason)

    def evaluate_approvals(self, db: Session, invoice_id: int) -> dict:
        """Evaluates rules and determines next state (AUTO_APPROVE or UNDER_REVIEW approval request)."""
        evaluation = RulesEngine.evaluate_invoice_rules(db, invoice_id)
        action = evaluation["action"]
        reason = evaluation["reason"]
        assigned_role = evaluation.get("assigned_role", "Manager")

        if action == "AUTO_APPROVE":
            self.engine.transition_to(db, invoice_id, WState.APPROVED, actor="system", reason=f"Auto-approved. {reason}")
            return {"status": "APPROVED", "message": "Invoice auto-approved successfully."}
        elif action == "HOLD":
            self.engine.transition_to(db, invoice_id, WState.ON_HOLD, actor="system", reason=f"Placed on hold. {reason}")
            return {"status": "ON_HOLD", "message": f"Invoice placed on hold: {reason}"}
        elif action == "MANUAL_REVIEW":
            self.engine.transition_to(db, invoice_id, WState.ON_HOLD, actor="system", reason=f"Sent to manual review. {reason}")
            return {"status": "ON_HOLD", "message": f"Invoice placed on hold for manual review: {reason}"}
        else:
            # Create Approval request and transition to UNDER_REVIEW
            self.engine.transition_to(db, invoice_id, WState.UNDER_REVIEW, actor="system", reason=f"Approval required: {reason}")
            req = ApprovalSystem.create_request(db, invoice_id, role=assigned_role, level=1)
            # Start approval SLA tracking
            SLAMonitor.start_sla(db, invoice_id, "APPROVAL", duration_hours=48)
            return {
                "status": "UNDER_REVIEW",
                "message": f"Approval requested from {assigned_role}.",
                "request_id": req.id
            }

    def approve_invoice(self, db: Session, invoice_id: int, request_id: int, actor: str, reason: str = None) -> dict:
        """Approve an active request and advance lifecycle if fully approved."""
        # 1. Action approval request
        req = ApprovalSystem.process_action(db, request_id, actor, "APPROVE", reason)
        
        # Check if there are other pending approvals or if it is fully approved
        # In this enterprise orchestration, we check if the request status has become APPROVED.
        if req.status == "APPROVED":
            # Check if there are next levels (using rules)
            invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            invoice_total = float(invoice.total_invoice_value or invoice.total_amount or 0.0) if invoice else 0.0
            
            # Simple multi-level approval check:
            # Level 1 approved Manager -> If amount > 100,000, we need VP approval too
            if req.current_level == 1 and invoice_total >= 100000.0 and req.assigned_role == "Manager":
                # Create Level 2 approval
                next_req = ApprovalSystem.create_request(db, invoice_id, role="VP", level=2)
                return {
                    "status": "UNDER_REVIEW",
                    "message": f"Level 1 approved. Assigned to next role: VP.",
                    "request_id": next_req.id
                }
            
            # Stop approval SLA
            SLAMonitor.resolve_sla(db, invoice_id, "APPROVAL")
            # Fully approved -> transition to APPROVED
            self.engine.transition_to(db, invoice_id, WState.APPROVED, actor=actor, reason=reason)
            return {"status": "APPROVED", "message": "Invoice fully approved."}
            
        return {"status": "UNDER_REVIEW", "message": "Approval request updated."}

    def reject_invoice(self, db: Session, invoice_id: int, request_id: int, actor: str, reason: str = None) -> dict:
        """Reject invoice and transition to REJECTED."""
        ApprovalSystem.process_action(db, request_id, actor, "REJECT", reason)
        SLAMonitor.resolve_sla(db, invoice_id, "APPROVAL")
        self.engine.transition_to(db, invoice_id, WState.REJECTED, actor=actor, reason=reason)
        return {"status": "REJECTED", "message": "Invoice rejected."}

    def put_on_hold(self, db: Session, invoice_id: int, actor: str = "system", reason: str = None) -> dict:
        """Manually put an invoice on hold."""
        return self.engine.transition_to(db, invoice_id, WState.ON_HOLD, actor=actor, reason=reason)

    def resume_processing(self, db: Session, invoice_id: int, actor: str = "system", reason: str = None) -> dict:
        """Resume processing of an invoice on hold."""
        # Check current state, if ON_HOLD we can transition back to READY_FOR_APPROVAL
        return self.engine.transition_to(db, invoice_id, WState.READY_FOR_APPROVAL, actor=actor, reason=reason)

    def cancel_workflow(self, db: Session, invoice_id: int, actor: str = "system", reason: str = None) -> dict:
        """Cancel workflow processing entirely."""
        SLAMonitor.resolve_sla(db, invoice_id, "PROCESSING")
        SLAMonitor.resolve_sla(db, invoice_id, "APPROVAL")
        return self.engine.transition_to(db, invoice_id, WState.CANCELLED, actor=actor, reason=reason)

    def get_status(self, db: Session, invoice_id: int) -> dict:
        """Returns details on the current execution state and SLA status."""
        instance = db.query(WorkflowInstance).filter(WorkflowInstance.invoice_id == invoice_id).first()
        if not instance:
            raise WorkflowException(f"No workflow instance found for Invoice {invoice_id}.")

        active_request = db.query(WorkflowApprovalRequest).filter(
            WorkflowApprovalRequest.invoice_id == invoice_id,
            WorkflowApprovalRequest.status.in_(["PENDING", "ESCALATED"])
        ).first()

        sla_rec = db.query(SLARecord).filter(
            SLARecord.invoice_id == invoice_id,
            SLARecord.resolved_at == None
        ).first()

        return {
            "invoice_id": invoice_id,
            "current_state": instance.current_state,
            "previous_state": instance.previous_state,
            "start_time": instance.start_time.isoformat(),
            "end_time": instance.end_time.isoformat() if instance.end_time else None,
            "retry_count": instance.retry_count,
            "active_approval": {
                "id": active_request.id,
                "role": active_request.assigned_role,
                "level": active_request.current_level,
                "deadline": active_request.sla_deadline.isoformat(),
                "status": active_request.status
            } if active_request else None,
            "active_sla": {
                "type": sla_rec.sla_type,
                "deadline": sla_rec.deadline.isoformat(),
                "breached": sla_rec.breached
            } if sla_rec else None
        }
