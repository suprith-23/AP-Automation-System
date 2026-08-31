"""Core Workflow Engine executing transitions, updating instances, and syncing database records."""
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.workflow.models import WorkflowInstance, WorkflowState
from app.workflow.state_machine import StateMachine, WorkflowState as WState
from app.workflow.audit import AuditLogger
from app.workflow.events import publish
from app.workflow.exceptions import WorkflowException

logger = logging.getLogger("workflow.engine")

class WorkflowEngine:
    @staticmethod
    def get_or_create_instance(db: Session, invoice_id: int) -> WorkflowInstance:
        """Fetch or create workflow instance for an invoice."""
        instance = db.query(WorkflowInstance).filter(WorkflowInstance.invoice_id == invoice_id).first()
        if not instance:
            invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            starting_state = WState.DRAFT
            if invoice and invoice.status:
                state_val = invoice.status.upper()
                if state_val == "MANUAL_REVIEW":
                    state_val = WState.UNDER_REVIEW
                starting_state = state_val

            instance = WorkflowInstance(
                invoice_id=invoice_id,
                current_state=starting_state,
                retry_count=0
            )
            db.add(instance)
            db.commit()
            db.refresh(instance)
            
            # Initialize starting state record
            state_rec = WorkflowState(
                instance_id=instance.id,
                state_name=starting_state,
                status="COMPLETED" if starting_state in [WState.APPROVED, WState.PAID, WState.ARCHIVED, WState.FAILED, WState.CANCELLED, WState.REJECTED] else "RUNNING",
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )
            db.add(state_rec)
            db.commit()
        return instance

    @staticmethod
    def transition_to(
        db: Session,
        invoice_id: int,
        target_state: str,
        actor: str = "system",
        reason: str = None,
        metadata_json: dict = None
    ) -> dict:
        """Performs state transition checking rules, writing audits, and publishing events."""
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        instance = WorkflowEngine.get_or_create_instance(db, invoice_id)
        current_state = instance.current_state
        target_state = target_state.upper()

        # 1. Validate FSM transition
        StateMachine.validate_transition(current_state, target_state)

        # 2. Update states
        # Terminate previous state running status
        active_state = db.query(WorkflowState).filter(
            WorkflowState.instance_id == instance.id,
            WorkflowState.state_name == current_state,
            WorkflowState.status == "RUNNING"
        ).first()
        if active_state:
            active_state.status = "COMPLETED"
            active_state.completed_at = datetime.utcnow()

        # Create or update target state record
        target_rec = db.query(WorkflowState).filter(
            WorkflowState.instance_id == instance.id,
            WorkflowState.state_name == target_state
        ).first()
        if not target_rec:
            target_rec = WorkflowState(
                instance_id=instance.id,
                state_name=target_state,
                status="RUNNING" if target_state not in [WState.APPROVED, WState.PAID, WState.ARCHIVED, WState.FAILED, WState.CANCELLED, WState.REJECTED] else "COMPLETED",
                started_at=datetime.utcnow()
            )
            db.add(target_rec)
        else:
            target_rec.status = "RUNNING"
            target_rec.started_at = datetime.utcnow()
            target_rec.completed_at = None

        if target_rec.status == "COMPLETED":
            target_rec.completed_at = datetime.utcnow()

        # Update instance properties
        instance.previous_state = current_state
        instance.current_state = target_state
        if target_state in [WState.ARCHIVED, WState.CANCELLED, WState.REJECTED]:
            instance.end_time = datetime.utcnow()

        # Synchronize Invoice model properties (backward compatibility)
        invoice.status = target_state
        
        # Synchronize workflow status
        if target_state == WState.APPROVED:
            invoice.workflow_status = InvoiceWorkflowStatus.approved
            try:
                from app.services.payment_manager import PaymentManager
                pm = PaymentManager()
                pm.initialize_payment_schedule(db, invoice)
            except Exception as e:
                logger.error(f"Error initializing payment schedule: {str(e)}")
        elif target_state in [WState.REJECTED, WState.CANCELLED]:
            invoice.workflow_status = InvoiceWorkflowStatus.rejected
        elif target_state in [WState.VALIDATED, WState.ON_HOLD]:
            invoice.workflow_status = InvoiceWorkflowStatus.pending_review
        elif target_state in [WState.DRAFT, WState.RECEIVED, WState.INGESTED, WState.OCR_COMPLETED, WState.AI_EXTRACTED]:
            invoice.workflow_status = InvoiceWorkflowStatus.validation_pending
        elif target_state in [WState.GST_VERIFIED, WState.TDS_VERIFIED, WState.PO_MATCHED, WState.READY_FOR_APPROVAL, WState.UNDER_REVIEW, WState.ESCALATED]:
            invoice.workflow_status = InvoiceWorkflowStatus.pending_approval
        elif target_state in [WState.ERP_SYNC_PENDING, WState.ERP_SYNCED, WState.PAYMENT_PENDING, WState.PAID, WState.ARCHIVED]:
            invoice.workflow_status = InvoiceWorkflowStatus.approved

        try:
            from app.core.metrics import WORKFLOW_APPROVAL_THROUGHPUT, WORKFLOW_AVG_DECISION_TIME
            tenant_id = str(invoice.organization_id) if invoice.organization_id else "global"
            if target_state == WState.APPROVED:
                WORKFLOW_APPROVAL_THROUGHPUT.labels(action="approve", tenant_id=tenant_id).inc()
            elif target_state == WState.REJECTED:
                WORKFLOW_APPROVAL_THROUGHPUT.labels(action="reject", tenant_id=tenant_id).inc()
                
            if target_state in [WState.APPROVED, WState.REJECTED] and active_state and active_state.started_at:
                decision_time = (datetime.utcnow() - active_state.started_at).total_seconds()
                role = "approver"
                WORKFLOW_AVG_DECISION_TIME.labels(role=role, tenant_id=tenant_id).observe(decision_time)
        except Exception:
            pass

        db.commit()

        # 3. Log Audit history
        AuditLogger.log_action(
            db=db,
            invoice_id=invoice_id,
            action=f"TRANSITION_{target_state}",
            state_before=current_state,
            state_after=target_state,
            performed_by=actor,
            reason=reason,
            metadata_json=metadata_json
        )

        # 4. Publish Event
        publish(
            db=db,
            event_type=f"{target_state.replace('_', '')}Completed" if "_" in target_state else f"Invoice{target_state.capitalize()}",
            invoice_id=invoice_id,
            payload={
                "previous_state": current_state,
                "new_state": target_state,
                "actor": actor,
                "reason": reason
            }
        )

        return {
            "invoice_id": invoice_id,
            "previous_state": current_state,
            "new_state": target_state,
            "success": True
        }
