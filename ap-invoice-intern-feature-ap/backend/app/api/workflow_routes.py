"""REST API endpoints for workflow orchestration, history, status, and approval actions."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.core.database import get_db
from app.workflow.manager import WorkflowManager
from app.workflow.history import HistoryTracker
from app.workflow.sla import SLAMonitor
from app.workflow.escalation import EscalationManager
from app.workflow.models import SLARecord
from app.workflow.exceptions import WorkflowException

from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    prefix="/workflow",
    tags=["Workflow Orchestration"],
    dependencies=[Depends(get_current_user)]
)

class StartRequest(BaseModel):
    invoice_id: int

class AdvanceRequest(BaseModel):
    invoice_id: int
    target_state: str
    actor: str = "system"
    reason: Optional[str] = None

class ApprovalActionRequest(BaseModel):
    invoice_id: int
    request_id: Optional[int] = None
    actor: str
    reason: Optional[str] = None

class HoldActionRequest(BaseModel):
    invoice_id: int
    actor: str = "system"
    reason: Optional[str] = None

@router.post("/start", response_model=Dict[str, Any])
def start_workflow_route(req: StartRequest, db: Session = Depends(get_db)):
    """Kicks off the workflow orchestration lifecycle for a draft invoice."""
    manager = WorkflowManager()
    try:
        return manager.start_workflow(db, req.invoice_id)
    except WorkflowException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/advance", response_model=Dict[str, Any])
def advance_workflow_route(req: AdvanceRequest, db: Session = Depends(get_db)):
    """Manually triggers workflow state transition."""
    manager = WorkflowManager()
    try:
        return manager.advance_workflow(
            db, req.invoice_id, req.target_state, actor=req.actor, reason=req.reason
        )
    except WorkflowException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/approve", response_model=Dict[str, Any])
def approve_invoice_route(
    req: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Approver", "Admin", "Super Admin"]))
):
    """Actions approval request validation and advances the workflow state."""
    from app.models.invoice import Invoice
    invoice = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    if org_id and invoice.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized organization access")

    manager = WorkflowManager()
    try:
        req_id = req.request_id
        if not req_id:
            from app.workflow.models import WorkflowApprovalRequest
            active_req = db.query(WorkflowApprovalRequest).filter(
                WorkflowApprovalRequest.invoice_id == req.invoice_id,
                WorkflowApprovalRequest.status.in_(["PENDING", "ESCALATED"])
            ).first()
            if active_req:
                req_id = active_req.id
        
        actor_name = current_user.name or current_user.email
        if req_id:
            from app.workflow.models import WorkflowApprovalRequest
            active_req = db.query(WorkflowApprovalRequest).filter(WorkflowApprovalRequest.id == req_id).first()
            if active_req and current_user.role != "Super Admin" and current_user.role != "Admin":
                if active_req.assigned_role.lower() != current_user.role.lower():
                    raise HTTPException(status_code=403, detail=f"Your role '{current_user.role}' does not match the assigned role '{active_req.assigned_role}' required for this approval.")
            return manager.approve_invoice(
                db, req.invoice_id, req_id, actor=actor_name, reason=req.reason
            )
        else:
            return manager.advance_workflow(
                db, req.invoice_id, "APPROVED", actor=actor_name, reason=req.reason
            )
    except WorkflowException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/reject", response_model=Dict[str, Any])
def reject_invoice_route(
    req: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Approver", "Admin", "Super Admin"]))
):
    """Rejects invoice matching or approval conditions."""
    from app.models.invoice import Invoice
    invoice = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    if org_id and invoice.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized organization access")

    manager = WorkflowManager()
    try:
        req_id = req.request_id
        if not req_id:
            from app.workflow.models import WorkflowApprovalRequest
            active_req = db.query(WorkflowApprovalRequest).filter(
                WorkflowApprovalRequest.invoice_id == req.invoice_id,
                WorkflowApprovalRequest.status.in_(["PENDING", "ESCALATED"])
            ).first()
            if active_req:
                req_id = active_req.id
                
        actor_name = current_user.name or current_user.email
        if req_id:
            from app.workflow.models import WorkflowApprovalRequest
            active_req = db.query(WorkflowApprovalRequest).filter(WorkflowApprovalRequest.id == req_id).first()
            if active_req and current_user.role != "Super Admin" and current_user.role != "Admin":
                if active_req.assigned_role.lower() != current_user.role.lower():
                    raise HTTPException(status_code=403, detail=f"Your role '{current_user.role}' does not match the assigned role '{active_req.assigned_role}' required for this rejection.")
            return manager.reject_invoice(
                db, req.invoice_id, req_id, actor=actor_name, reason=req.reason
            )
        else:
            return manager.advance_workflow(
                db, req.invoice_id, "REJECTED", actor=actor_name, reason=req.reason
            )
    except WorkflowException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/escalate", response_model=Dict[str, Any])
def escalate_workflow_route(req: StartRequest, db: Session = Depends(get_db)):
    """Triggers manual SLA breach escalation."""
    sla_rec = db.query(SLARecord).filter(
        SLARecord.invoice_id == req.invoice_id,
        SLARecord.resolved_at == None
    ).first()
    if not sla_rec:
        raise HTTPException(status_code=404, detail="No active SLA record found to escalate.")
    
    sla_rec.breached = True
    db.commit()
    EscalationManager.escalate_sla(db, sla_rec)
    return {"success": True, "message": "Manual escalation triggered successfully."}

@router.post("/hold", response_model=Dict[str, Any])
def put_on_hold_route(req: HoldActionRequest, db: Session = Depends(get_db)):
    """Sets workflow state to ON_HOLD."""
    manager = WorkflowManager()
    try:
        return manager.put_on_hold(db, req.invoice_id, actor=req.actor, reason=req.reason)
    except WorkflowException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/resume", response_model=Dict[str, Any])
def resume_workflow_route(req: HoldActionRequest, db: Session = Depends(get_db)):
    """Resumes processing from hold state."""
    manager = WorkflowManager()
    try:
        return manager.resume_processing(db, req.invoice_id, actor=req.actor, reason=req.reason)
    except WorkflowException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cancel", response_model=Dict[str, Any])
def cancel_workflow_route(req: HoldActionRequest, db: Session = Depends(get_db)):
    """Cancels workflow orchestration execution."""
    manager = WorkflowManager()
    try:
        return manager.cancel_workflow(db, req.invoice_id, actor=req.actor, reason=req.reason)
    except WorkflowException as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{invoice_id}/history", response_model=List[Dict[str, Any]])
def get_history_route(invoice_id: int, db: Session = Depends(get_db)):
    """Retrieves full workflow history and audit trail timeline details."""
    return HistoryTracker.get_timeline(db, invoice_id)

@router.get("/{invoice_id}/status", response_model=Dict[str, Any])
def get_workflow_status_route(invoice_id: int, db: Session = Depends(get_db)):
    """Returns current active status, SLAs, and assignment queues."""
    manager = WorkflowManager()
    try:
        return manager.get_status(db, invoice_id)
    except WorkflowException as e:
        raise HTTPException(status_code=404, detail=str(e))
