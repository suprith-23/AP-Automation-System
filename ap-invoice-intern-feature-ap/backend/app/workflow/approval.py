"""Approval engine implementation containing request routing, delegation, actions, and chain progression."""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.workflow.models import WorkflowApprovalRequest, WorkflowApprovalAction
from app.workflow.exceptions import ApprovalException

logger = logging.getLogger("workflow.approval")

class ApprovalSystem:
    @staticmethod
    def create_request(
        db: Session,
        invoice_id: int,
        role: str,
        level: int = 1,
        assigned_user_id: int = None,
        sla_hours: int = 48
    ) -> WorkflowApprovalRequest:
        """Create a new approval request at a specific level."""
        deadline = datetime.utcnow() + timedelta(hours=sla_hours)
        req = WorkflowApprovalRequest(
            invoice_id=invoice_id,
            assigned_role=role,
            assigned_user_id=assigned_user_id,
            current_level=level,
            status="PENDING",
            sla_deadline=deadline
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        logger.info(f"Approval Request created for Invoice {invoice_id} at Level {level} (Role: {role}).")
        return req

    @staticmethod
    def process_action(
        db: Session,
        request_id: int,
        actor: str,
        action_type: str,  # APPROVE, REJECT, DELEGATE, REASSIGN, OVERRIDE
        reason: str = None,
        delegate_user_id: int = None,
        delegate_role: str = None
    ) -> WorkflowApprovalRequest:
        """Process an approval action (Approve, Reject, Delegate, Reassign)."""
        req = db.query(WorkflowApprovalRequest).filter(WorkflowApprovalRequest.id == request_id).first()
        if not req:
            raise ApprovalException(f"Approval request {request_id} not found.")

        if req.status not in ["PENDING", "ESCALATED"]:
            raise ApprovalException(f"Cannot action request {request_id} because its status is {req.status}.")

        action_type = action_type.upper()
        
        # 1. Update request status based on action
        if action_type == "APPROVE":
            req.status = "APPROVED"
        elif action_type == "REJECT":
            req.status = "REJECTED"
        elif action_type in ["DELEGATE", "REASSIGN"]:
            req.status = "DELEGATED"
        elif action_type == "OVERRIDE":
            req.status = "APPROVED"
        else:
            raise ApprovalException(f"Invalid approval action: {action_type}")

        # 2. Save approval action record
        action_log = WorkflowApprovalAction(
            request_id=req.id,
            actor=actor,
            action=action_type,
            reason=reason,
            metadata_json={
                "delegate_user_id": delegate_user_id,
                "delegate_role": delegate_role
            }
        )
        db.add(action_log)
        db.commit()

        # 3. If delegated, create a new request for the delegated user/role
        if action_type in ["DELEGATE", "REASSIGN"]:
            new_role = delegate_role or req.assigned_role
            ApprovalSystem.create_request(
                db=db,
                invoice_id=req.invoice_id,
                role=new_role,
                level=req.current_level,  # remains at the same level
                assigned_user_id=delegate_user_id
            )

        db.commit()
        db.refresh(req)
        return req
