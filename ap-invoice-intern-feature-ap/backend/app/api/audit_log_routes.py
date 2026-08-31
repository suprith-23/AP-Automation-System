"""API routes for retrieving audit logs with tenant isolation."""

from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.audit_log import AuditLogResponse
from app.services.audit_log_service import get_all_audit_logs, get_audit_logs_by_invoice
from app.services.invoice_service import get_invoice_by_id
from app.dependencies import get_current_user, RoleChecker

# Initialize router for audit logs
router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"],
    dependencies=[Depends(get_current_user)]
)


@router.get(
    "/",
    response_model=List[AuditLogResponse]
)
def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"]))
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    return get_all_audit_logs(db=db, limit=limit, offset=offset, organization_id=org_id)


@router.get(
    "/invoice/{invoice_id}",
    response_model=List[AuditLogResponse]
)
def get_invoice_audit_logs(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    
    # Verify invoice belongs to organization
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return get_audit_logs_by_invoice(db=db, invoice_id=invoice_id, organization_id=org_id)


from pydantic import BaseModel

class LogSeenRequest(BaseModel):
    invoice_id: int
    user_role: str

@router.post("/log-seen")
def log_seen_notification(
    payload: LogSeenRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from app.services.audit_log_service import create_audit_log
    create_audit_log(
        db=db,
        action="NOTIFICATION_SEEN",
        invoice_id=payload.invoice_id,
        performed_by=current_user.name or current_user.email,
        details={"invoice_id": payload.invoice_id, "user_role": payload.user_role},
        organization_id=current_user.organization_id
    )
    return {"status": "success"}
