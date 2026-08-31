"""Escalation management and delegation routing."""
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.workflow.models import EscalationRecord, SLARecord, WorkflowApprovalRequest

logger = logging.getLogger("workflow.escalation")

class EscalationManager:
    @staticmethod
    def escalate_sla(db: Session, sla_record: SLARecord) -> EscalationRecord:
        """Triggers escalation routine for a breached SLA record."""
        # Find active escalation level
        existing_esc = db.query(EscalationRecord).filter(
            EscalationRecord.sla_record_id == sla_record.id,
            EscalationRecord.status == "PENDING"
        ).order_by(EscalationRecord.level.desc()).first()

        next_level = 1
        if existing_esc:
            next_level = existing_esc.level + 1
            existing_esc.status = "RESOLVED"
            existing_esc.resolved_at = datetime.utcnow()

        # Route assignment to next tier
        original_assignee = None
        escalated_assignee = None

        if sla_record.sla_type == "APPROVAL":
            # Escalate the approval request
            active_req = db.query(WorkflowApprovalRequest).filter(
                WorkflowApprovalRequest.invoice_id == sla_record.invoice_id,
                WorkflowApprovalRequest.status == "PENDING"
            ).first()
            if active_req:
                original_assignee = active_req.assigned_role
                if active_req.assigned_role == "Manager":
                    escalated_assignee = "VP"
                elif active_req.assigned_role == "VP":
                    escalated_assignee = "CFO"
                else:
                    escalated_assignee = "Director"
                
                active_req.assigned_role = escalated_assignee
                active_req.status = "ESCALATED"

        record = EscalationRecord(
            sla_record_id=sla_record.id,
            level=next_level,
            original_assignee=original_assignee,
            escalated_assignee=escalated_assignee,
            status="PENDING",
            triggered_at=datetime.utcnow()
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.warning(
            f"Escalation Level {next_level} triggered for Invoice {sla_record.invoice_id}. "
            f"Role reassigned from {original_assignee} to {escalated_assignee}."
        )
        return record
