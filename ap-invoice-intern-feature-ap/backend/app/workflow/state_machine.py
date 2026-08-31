"""State machine configuration and state transition validator."""
import logging
from typing import List, Dict
from app.workflow.exceptions import InvalidTransitionException

logger = logging.getLogger("workflow.state_machine")

class WorkflowState:
    DRAFT = "DRAFT"
    RECEIVED = "RECEIVED"
    INGESTED = "INGESTED"
    OCR_COMPLETED = "OCR_COMPLETED"
    AI_EXTRACTED = "AI_EXTRACTED"
    VALIDATED = "VALIDATED"
    GST_VERIFIED = "GST_VERIFIED"
    TDS_VERIFIED = "TDS_VERIFIED"
    PO_MATCHED = "PO_MATCHED"
    READY_FOR_APPROVAL = "READY_FOR_APPROVAL"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    ERP_SYNC_PENDING = "ERP_SYNC_PENDING"
    ERP_SYNCED = "ERP_SYNCED"
    PAYMENT_PENDING = "PAYMENT_PENDING"
    PAID = "PAID"
    ARCHIVED = "ARCHIVED"

    # Exception States
    REJECTED = "REJECTED"
    FAILED = "FAILED"
    ESCALATED = "ESCALATED"
    ON_HOLD = "ON_HOLD"
    CANCELLED = "CANCELLED"

# Canonical definition of all valid transitions from each state
TRANSITION_GRAPH: Dict[str, List[str]] = {
    WorkflowState.DRAFT: [WorkflowState.RECEIVED, WorkflowState.CANCELLED],
    WorkflowState.RECEIVED: [WorkflowState.INGESTED, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.INGESTED: [WorkflowState.OCR_COMPLETED, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.OCR_COMPLETED: [WorkflowState.AI_EXTRACTED, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.AI_EXTRACTED: [WorkflowState.VALIDATED, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.VALIDATED: [WorkflowState.GST_VERIFIED, WorkflowState.ON_HOLD, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.GST_VERIFIED: [WorkflowState.TDS_VERIFIED, WorkflowState.ON_HOLD, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.TDS_VERIFIED: [WorkflowState.PO_MATCHED, WorkflowState.ON_HOLD, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.PO_MATCHED: [WorkflowState.READY_FOR_APPROVAL, WorkflowState.ON_HOLD, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.READY_FOR_APPROVAL: [WorkflowState.UNDER_REVIEW, WorkflowState.APPROVED, WorkflowState.ON_HOLD, WorkflowState.FAILED, WorkflowState.CANCELLED],
    WorkflowState.UNDER_REVIEW: [WorkflowState.APPROVED, WorkflowState.REJECTED, WorkflowState.ESCALATED, WorkflowState.ON_HOLD, WorkflowState.CANCELLED],
    WorkflowState.ESCALATED: [WorkflowState.APPROVED, WorkflowState.REJECTED, WorkflowState.ON_HOLD, WorkflowState.CANCELLED],
    WorkflowState.APPROVED: [WorkflowState.ERP_SYNC_PENDING, WorkflowState.CANCELLED],
    WorkflowState.ERP_SYNC_PENDING: [WorkflowState.ERP_SYNCED, WorkflowState.FAILED],
    WorkflowState.ERP_SYNCED: [WorkflowState.PAYMENT_PENDING, WorkflowState.FAILED],
    WorkflowState.PAYMENT_PENDING: [WorkflowState.PAID, WorkflowState.FAILED],
    WorkflowState.PAID: [WorkflowState.ARCHIVED],
    WorkflowState.ARCHIVED: [],
    
    # Exception pathways
    WorkflowState.REJECTED: [WorkflowState.DRAFT, WorkflowState.ARCHIVED],
    WorkflowState.FAILED: [WorkflowState.READY_FOR_APPROVAL, WorkflowState.DRAFT, WorkflowState.CANCELLED],
    WorkflowState.ON_HOLD: [WorkflowState.READY_FOR_APPROVAL, WorkflowState.CANCELLED],
    WorkflowState.CANCELLED: []
}

class StateMachine:
    @staticmethod
    def validate_transition(current_state: str, target_state: str) -> bool:
        """Validate if a transition from current_state to target_state is permitted."""
        c_state = current_state.upper()
        t_state = target_state.upper()

        # Backward compatibility with legacy state names
        if c_state == "MANUAL_REVIEW":
            c_state = "UNDER_REVIEW"
        if t_state == "MANUAL_REVIEW":
            t_state = "UNDER_REVIEW"

        if c_state == t_state:
            return True

        if c_state not in TRANSITION_GRAPH:
            raise InvalidTransitionException(f"Source state '{c_state}' is not a valid workflow state.")

        allowed = TRANSITION_GRAPH[c_state]
        if t_state not in allowed:
            raise InvalidTransitionException(
                f"Transition not allowed from state '{c_state}' to state '{t_state}'."
            )
            
        return True
