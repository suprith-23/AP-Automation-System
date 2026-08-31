"""History tracking and timeline retrieval for workflow execution."""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.workflow.models import WorkflowHistory, WorkflowApprovalRequest, WorkflowApprovalAction

class HistoryTracker:
    @staticmethod
    def get_timeline(db: Session, invoice_id: int) -> List[Dict[str, Any]]:
        """
        Builds a comprehensive timestamped timeline of all actions and state
        transitions that occurred on a specific invoice.
        """
        timeline = []
        
        # 1. State Transitions / History entries
        history_entries = db.query(WorkflowHistory).filter(
            WorkflowHistory.invoice_id == invoice_id
        ).order_by(WorkflowHistory.timestamp.asc()).all()

        for entry in history_entries:
            timeline.append({
                "type": "TRANSITION",
                "action": entry.action,
                "before": entry.state_before,
                "after": entry.state_after,
                "actor": entry.performed_by,
                "performed_by": entry.performed_by,  # legacy support
                "status_before": entry.state_before,  # legacy support
                "status_after": entry.state_after,    # legacy support
                "reason": entry.reason,
                "details": entry.metadata_json or {},
                "timestamp": entry.timestamp.isoformat()
            })

        # 2. Approval Requests and Actions
        approval_reqs = db.query(WorkflowApprovalRequest).filter(
            WorkflowApprovalRequest.invoice_id == invoice_id
        ).all()

        for req in approval_reqs:
            # Add request trace
            timeline.append({
                "type": "APPROVAL_REQUEST",
                "assigned_role": req.assigned_role,
                "level": req.current_level,
                "status": req.status,
                "deadline": req.sla_deadline.isoformat(),
                "timestamp": req.created_at.isoformat()
            })

            # Add actions taken on this request
            for act in req.actions:
                timeline.append({
                    "type": "APPROVAL_ACTION",
                    "actor": act.actor,
                    "action": act.action,
                    "reason": act.reason,
                    "timestamp": act.timestamp.isoformat()
                })

        # Sort combined list chronologically
        timeline.sort(key=lambda x: x["timestamp"])
        return timeline
