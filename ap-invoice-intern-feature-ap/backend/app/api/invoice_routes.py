"""Invoice API routes with tenant isolation."""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.schemas.invoice import InvoiceCreate, InvoiceResponse, InvoiceUpdate, InvoiceSummaryResponse, InvoiceWorkflowStatus
from app.services.invoice_service import (
    create_invoice,
    delete_invoice,
    get_all_invoices,
    get_invoice_by_id,
    update_invoice,
    run_invoice_matching,
    get_reviewer_queue,
    submit_invoice_for_approval,
    get_approver_queue,
    approve_invoice,
    reject_invoice,
    release_invoice_for_payment,
    confirm_invoice_payment,
    update_invoice_fields,
    reopen_invoice,
)
from app.dependencies import get_current_user, RoleChecker
from pydantic import BaseModel

class InvoiceFieldsUpdateRequest(BaseModel):
    updates: Dict[str, Any]

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"],
    dependencies=[Depends(get_current_user)]
)


@router.get(
    "/reviewer-queue",
    response_model=List[InvoiceSummaryResponse]
)
def get_reviewer_queue_route(
    db: Session = Depends(get_db),
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    current_user = Depends(RoleChecker(["Reviewer", "Admin"])) # Stage 1: Reviewer Intake Queue
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    return get_reviewer_queue(db, page=page, page_size=page_size, organization_id=org_id)


@router.post(
    "/{invoice_id}/submit-for-approval",
    response_model=InvoiceResponse
)
def submit_for_approval_route(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Admin"])) # Stage 1: Reviewer Intake/Submit
):
    try:
        # Verify tenant access before submitting
        org_id = current_user.organization_id if current_user.role != "Super Admin" else None
        invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return submit_invoice_for_approval(db, invoice_id)
    except Exception as e:
        with open("/tmp/last_submission_error.txt", "a") as f:
            f.write(f"SUBMIT FOR APPROVAL ERROR: {str(e)}\n")
            if hasattr(e, "detail"):
                f.write(f"DETAIL: {getattr(e, 'detail')}\n")
        raise


@router.get(
    "/approver-queue",
    response_model=List[InvoiceSummaryResponse]
)
def get_approver_queue_route(
    db: Session = Depends(get_db),
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    current_user = Depends(RoleChecker(["Approver", "Admin"])) # Stage 2: Approver Queue
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    return get_approver_queue(db, page=page, page_size=page_size, organization_id=org_id)


@router.post(
    "/{invoice_id}/approve",
    response_model=InvoiceResponse
)
def approve_invoice_route(
    invoice_id: int,
    justification: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Approver", "Admin"])) # Stage 2: Approver Final Decision
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return approve_invoice(db, invoice_id, justification=justification or "")


@router.post(
    "/{invoice_id}/reject",
    response_model=InvoiceResponse
)
def reject_invoice_route(
    invoice_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Approver", "Admin"])) # Shared Stage 1 & 2: Rejection (both stages)
):
    if not reason or len(reason.strip()) < 3:
        reason = "Discrepancy detected"
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return reject_invoice(db, invoice_id, reason=reason)


@router.post(
    "/{invoice_id}/release",
    response_model=InvoiceResponse
)
def release_invoice_route(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Approver", "Admin"])) # Stage 2: Approver Final Payment Release
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return release_invoice_for_payment(db, invoice_id, actor=current_user.name)


@router.post(
    "/{invoice_id}/confirm-payment",
    response_model=InvoiceResponse
)
def confirm_invoice_payment_route(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Approver", "Admin"])) # Stage 2: Approver Final Payment Recording
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return confirm_invoice_payment(db, invoice_id, actor=current_user.name)


@router.patch(
    "/{invoice_id}/fields",
    response_model=InvoiceResponse
)
def update_invoice_fields_route(
    invoice_id: int,
    request: InvoiceFieldsUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Admin"])) # Stage 1: Reviewer Manual Field Correction
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return update_invoice_fields(db, invoice_id, request.updates, actor=current_user.name)


@router.post(
    "/",
    response_model=InvoiceResponse
)
def create_invoice_route(
    invoice: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"])), # Admin Stage: Ingestion/Setup
    organization_id: Optional[UUID] = None
):
    if current_user.role == "Super Admin":
        if not organization_id:
            raise HTTPException(
                status_code=400,
                detail="Super Admins must provide an organization_id when creating an invoice."
            )
        org_id = organization_id
    else:
        org_id = current_user.organization_id
        
    return create_invoice(db, invoice, organization_id=org_id)


@router.get(
    "/",
    response_model=List[InvoiceSummaryResponse]
)
def list_invoices(
    db: Session = Depends(get_db),
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    

    
    return get_all_invoices(db, page=page, page_size=page_size, organization_id=org_id)


@router.get(
    "/{invoice_id}",
    response_model=InvoiceResponse
)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )

    return invoice


@router.get(
    "/{invoice_id}/status",
    response_model=dict
)
def get_invoice_status_route(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
        
    return {
        "invoice_id": invoice.id,
        "workflow_status": invoice.workflow_status
    }


@router.put(
    "/{invoice_id}",
    response_model=InvoiceResponse
)
def update_invoice_route(
    invoice_id: int,
    invoice_update: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Admin"])) # Stage 1: Reviewer Update details
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
    
    if current_user.role == "Reviewer":
        allowed_states = [
            InvoiceWorkflowStatus.validation_pending,
            InvoiceWorkflowStatus.pending_review,
            InvoiceWorkflowStatus.validation_failed
        ]
        if invoice.workflow_status not in allowed_states:
            raise HTTPException(
                status_code=403,
                detail="Reviewers can only update pre-approval state invoices"
            )

    return update_invoice(db, invoice_id, invoice_update)


@router.delete("/{invoice_id}")
def delete_invoice_route(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"])) # Admin Stage: Ingestion/Setup Cleanup
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
    delete_invoice(db, invoice_id)
    return {
        "message": "Invoice deleted successfully"
    }


@router.post("/{invoice_id}/match", response_model=InvoiceResponse)
def match_invoice_route(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Admin"])) # Stage 1: Reviewer 3-Way Match trigger
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
    return run_invoice_matching(db, invoice_id)


@router.post("/validate", response_model=dict)
def validate_normalized_invoice(
    invoice_data: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from app.validation.service import ValidationService
    val_service = ValidationService()
    report = val_service.validate(invoice_data, db=db)
    return report


class MatchRequest(BaseModel):
    invoice_id: int


@router.post("/match", response_model=dict)
def match_invoice_to_po_endpoint(
    request: MatchRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, request.invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
    from app.matching.service import POMatchingService
    matching_service = POMatchingService()
    try:
        report = matching_service.match_and_persist(db, request.invoice_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{invoice_id}/reprocess", response_model=InvoiceResponse)
async def reprocess_invoice_route(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"])) # Admin Stage: Force Ingestion/Reprocessing
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
    from app.services.invoice_service import reprocess_invoice
    invoice = await reprocess_invoice(db, invoice_id)
    return invoice


# --- Invoice Comments Endpoints ---

from app.models.comment import InvoiceComment
from app.schemas.comment import CommentCreate, CommentResponse

@router.get("/{invoice_id}/comments", response_model=List[CommentResponse])
def get_invoice_comments(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin", "Reviewer", "Approver", "Auditor"]))
):
    """Retrieve all comments for an invoice with tenant verification."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    rows = db.query(InvoiceComment).filter(InvoiceComment.invoice_id == invoice_id).order_by(InvoiceComment.created_at.asc()).all()
    
    # Map to schema containing user details
    results = []
    for r in rows:
        results.append(
            CommentResponse(
                id=r.id,
                invoice_id=r.invoice_id,
                user_id=r.user_id,
                user_name=r.user.name if r.user else "System",
                user_role=r.user.role if r.user else "System",
                text=r.text,
                created_at=r.created_at
            )
        )
    return results

@router.post("/{invoice_id}/comments", response_model=CommentResponse, status_code=201)
def create_invoice_comment(
    invoice_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin", "Reviewer", "Approver"])) # Auditor read-only block
):
    """Post a comment on an invoice with tenant verification."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    row = InvoiceComment(
        invoice_id=invoice_id,
        user_id=current_user.id,
        text=payload.text
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return CommentResponse(
        id=row.id,
        invoice_id=row.invoice_id,
        user_id=row.user_id,
        user_name=current_user.name,
        user_role=current_user.role,
        text=row.text,
        created_at=row.created_at
    )


@router.post(
    "/{invoice_id}/reopen",
    response_model=InvoiceResponse
)
def reopen_invoice_route(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin", "Super Admin", "Approver"]))
):
    """Reopen a resolved invoice back to the review stage."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = get_invoice_by_id(db, invoice_id, organization_id=org_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return reopen_invoice(db, invoice_id, actor=current_user.name)