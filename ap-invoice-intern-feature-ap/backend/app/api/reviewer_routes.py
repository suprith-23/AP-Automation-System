from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel

from app.core.database import get_db
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.models.settings import Settings
from app.models.audit_log import AuditLog
from app.models.user import User
from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    prefix="/reviewer",
    tags=["Reviewer Validation Workbench"],
    dependencies=[Depends(get_current_user)]
)

class ReviewerSubmitRequest(BaseModel):
    updates: Dict[str, Any]
    checklist_completed: Dict[str, bool]
    comments: List[str]
    free_text_comment: str
    duration_seconds: int

class ReviewerRejectRequest(BaseModel):
    predefined_reasons: List[str]
    free_text_reason: str
    return_to_vendor: bool

class AssignReviewerRequest(BaseModel):
    reviewer_id: UUID

class BulkReassignRequest(BaseModel):
    from_reviewer_id: UUID
    to_reviewer_id: UUID

@router.get("/queues")
def get_classified_queues(
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Admin", "Auditor"]))
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    
    query = db.query(Invoice)
    if org_id:
        query = query.filter(Invoice.organization_id == org_id)
    
    invoices = query.all()
    settings = db.query(Settings).first()
    threshold = settings.ai_confidence_threshold if settings else 0.85

    queues = {
        "review_queue": [],
        "low_confidence": [],
        "validation_errors": [],
        "duplicate_review": [],
        "missing_information": [],
        "returned_by_approver": [],
        "completed_reviews": []
    }

    for inv in invoices:
        status_str = inv.workflow_status.value if hasattr(inv.workflow_status, "value") else str(inv.workflow_status)
        
        # 1. Review Queue: Any pending review / validation failed items
        if status_str in ["pending_review", "validation_failed"]:
            queues["review_queue"].append(inv)
            
        # 2. Low Confidence: average confidence < threshold
        conf = inv.confidence_score if inv.confidence_score is not None else 1.0
        if status_str in ["pending_review", "validation_failed"] and conf < threshold:
            queues["low_confidence"].append(inv)
            
        # 3. Validation Errors: status validation_failed
        if status_str == "validation_failed" or inv.validation_status == "failed":
            queues["validation_errors"].append(inv)
            
        # 4. Duplicate Review
        if status_str in ["pending_review", "validation_failed"] and (inv.validation_errors and "duplicate" in str(inv.validation_errors).lower()):
            queues["duplicate_review"].append(inv)
            
        # 5. Missing Information: required fields empty
        if status_str in ["pending_review", "validation_failed"]:
            missing = False
            for field in ["invoice_number", "invoice_date", "seller_gstin", "buyer_gstin", "total_invoice_value"]:
                if getattr(inv, field, None) in [None, "", 0.0]:
                    missing = True
                    break
            if missing:
                queues["missing_information"].append(inv)
                
        # 6. Returned by Approver: checking audit logs or status indicators
        # Simple flag check or filter if status is validation failed after rejection
        # For simulation, we check if audit logs contain a REJECTED status before moving to pending_review
        if status_str == "pending_review":
            has_been_rejected = db.query(AuditLog).filter(
                AuditLog.invoice_id == inv.id,
                AuditLog.action == "INVOICE_REJECTED"
            ).first()
            if has_been_rejected:
                queues["returned_by_approver"].append(inv)
                
        # 7. Completed Reviews: approved, scheduled, paid, payment_queue
        if status_str in ["approved", "payment_queue", "scheduled", "paid", "payment_completed"]:
            queues["completed_reviews"].append(inv)

    return {k: [i.id for i in v] for k, v in queues.items()}


@router.get("/my-queue")
def get_my_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Reviewer", "Admin"])),
):
    """
    Returns invoices explicitly assigned to the current Reviewer.
    Admins see all unassigned + assigned invoices in their org.
    """
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    query = db.query(Invoice)
    if org_id:
        query = query.filter(Invoice.organization_id == org_id)

    if current_user.role == "Reviewer":
        # Personal queue: explicitly assigned to this user OR unassigned in org
        from sqlalchemy import or_
        query = query.filter(
            or_(
                Invoice.assigned_reviewer_id == current_user.id,
                Invoice.assigned_reviewer_id == None
            )
        )
    # Admins: return all pending_review invoices in org (no assignee filter)

    invoices = query.filter(
        Invoice.workflow_status.in_([
            InvoiceWorkflowStatus.pending_review,
            InvoiceWorkflowStatus.validation_failed,
        ])
    ).order_by(Invoice.assigned_at.asc().nullslast()).all()

    return [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "seller_name": inv.seller_name,
            "total_invoice_value": inv.total_invoice_value,
            "workflow_status": inv.workflow_status.value if hasattr(inv.workflow_status, "value") else str(inv.workflow_status),
            "confidence_score": inv.confidence_score,
            "assigned_at": inv.assigned_at.isoformat() if inv.assigned_at else None,
            "organization_id": str(inv.organization_id) if inv.organization_id else None,
        }
        for inv in invoices
    ]


@router.post("/invoices/{invoice_id}/assign")
def assign_invoice(
    invoice_id: int,
    request: AssignReviewerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"])),
):
    """
    Admin assigns a specific invoice to a Reviewer.
    Validates: invoice is in pending_review/validation_failed, target user is a Reviewer
    in the same org, and assignment is logged in audit trail.
    """
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if org_id and invoice.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized organization access")

    status_str = invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else str(invoice.workflow_status)
    if status_str not in ["pending_review", "validation_failed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invoice is not in a reviewable state (current: {status_str})",
        )

    # Verify target reviewer exists, is active, is a Reviewer, and is in the same org
    reviewer = db.query(User).filter(User.id == request.reviewer_id).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer user not found")
    if not reviewer.is_active:
        raise HTTPException(status_code=400, detail="Cannot assign to an inactive reviewer")
    if reviewer.role != "Reviewer":
        raise HTTPException(status_code=400, detail="Target user is not a Reviewer")
    if org_id and reviewer.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Reviewer belongs to a different organization")

    prev_reviewer_id = str(invoice.assigned_reviewer_id) if invoice.assigned_reviewer_id else None
    invoice.assigned_reviewer_id = reviewer.id
    invoice.assigned_at = datetime.utcnow()

    db.add(AuditLog(
        invoice_id=invoice.id,
        organization_id=invoice.organization_id,
        action="INVOICE_REVIEWER_ASSIGNED",
        status_before=status_str,
        status_after=status_str,
        performed_by=current_user.name or current_user.email,
        details={
            "assigned_to": reviewer.name or reviewer.email,
            "assigned_reviewer_id": str(reviewer.id),
            "previous_reviewer_id": prev_reviewer_id,
        },
    ))

    db.commit()
    db.refresh(invoice)
    return {
        "success": True,
        "invoice_id": invoice.id,
        "assigned_reviewer_id": str(invoice.assigned_reviewer_id),
        "assigned_at": invoice.assigned_at.isoformat(),
    }


@router.post("/users/{reviewer_id}/reassign-queue")
def bulk_reassign_queue(
    reviewer_id: UUID,
    request: BulkReassignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"])),
):
    """
    Bulk-reassigns all pending invoices from a deactivated/departing Reviewer
    to another active Reviewer in the same org. Intended to be called as part
    of the deactivation flow in User Management.
    """
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None

    # Validate target reviewer
    to_reviewer = db.query(User).filter(User.id == request.to_reviewer_id).first()
    if not to_reviewer:
        raise HTTPException(status_code=404, detail="Target reviewer not found")
    if not to_reviewer.is_active:
        raise HTTPException(status_code=400, detail="Cannot reassign to an inactive reviewer")
    if to_reviewer.role != "Reviewer":
        raise HTTPException(status_code=400, detail="Target user is not a Reviewer")
    if org_id and to_reviewer.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Target reviewer is in a different organization")

    # Find all pending invoices assigned to the departing reviewer
    pending = db.query(Invoice).filter(
        Invoice.assigned_reviewer_id == request.from_reviewer_id,
        Invoice.workflow_status.in_([
            InvoiceWorkflowStatus.pending_review,
            InvoiceWorkflowStatus.validation_failed,
        ]),
    )
    if org_id:
        pending = pending.filter(Invoice.organization_id == org_id)

    invoices_to_move = pending.all()
    now = datetime.utcnow()
    actor = current_user.name or current_user.email

    for inv in invoices_to_move:
        status_str = inv.workflow_status.value if hasattr(inv.workflow_status, "value") else str(inv.workflow_status)
        inv.assigned_reviewer_id = to_reviewer.id
        inv.assigned_at = now
        db.add(AuditLog(
            invoice_id=inv.id,
            organization_id=inv.organization_id,
            action="INVOICE_REVIEWER_REASSIGNED",
            status_before=status_str,
            status_after=status_str,
            performed_by=actor,
            details={
                "from_reviewer_id": str(request.from_reviewer_id),
                "to_reviewer_id": str(to_reviewer.id),
                "to_reviewer_name": to_reviewer.name or to_reviewer.email,
                "reason": "bulk_reassignment",
            },
        ))

    db.commit()
    return {
        "success": True,
        "reassigned_count": len(invoices_to_move),
        "to_reviewer_id": str(to_reviewer.id),
        "to_reviewer_name": to_reviewer.name or to_reviewer.email,
    }


@router.get("/users/{reviewer_id}/stats")
def get_reviewer_stats(
    reviewer_id: UUID,
    period_days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Auditor"])),
):
    """
    Per-reviewer performance stats for Admin-facing dashboard.
    Returns correction_rate as a pipeline health signal, NOT a productivity metric.
    period_days defaults to 7 (last week).
    """
    from datetime import timedelta
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None

    reviewer = db.query(User).filter(User.id == reviewer_id).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    if reviewer.role != "Reviewer":
        raise HTTPException(status_code=400, detail="User is not a Reviewer")
    if org_id and reviewer.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Reviewer is in a different organization")

    since = datetime.utcnow() - timedelta(days=period_days)
    actor_name = reviewer.name or reviewer.email

    # All audit logs for this reviewer in the period
    logs = db.query(AuditLog).filter(
        AuditLog.performed_by == actor_name,
        AuditLog.timestamp >= since,
    ).all()
    if org_id:
        logs = [l for l in logs if l.organization_id == org_id]

    decisions = 0
    corrections = 0
    rejections = 0
    total_duration_seconds = 0
    duration_count = 0
    corrections_by_field: dict = {}

    for log in logs:
        if log.action in ["INVOICE_SUBMITTED_FOR_APPROVAL", "INVOICE_REJECTED"]:
            decisions += 1
        if log.action == "INVOICE_REJECTED":
            rejections += 1
        if log.action in ["FIELD_MANUALLY_CORRECTED", "LINE_ITEMS_MANUALLY_CORRECTED"]:
            corrections += 1
            field = (log.details or {}).get("field", "unknown")
            corrections_by_field[field] = corrections_by_field.get(field, 0) + 1

    # Duration: from invoices assigned to this reviewer
    reviewed_invoices = db.query(Invoice).filter(
        Invoice.assigned_reviewer_id == reviewer_id,
        Invoice.review_duration_seconds > 0,
    )
    if org_id:
        reviewed_invoices = reviewed_invoices.filter(Invoice.organization_id == org_id)
    for inv in reviewed_invoices.all():
        total_duration_seconds += inv.review_duration_seconds
        duration_count += 1

    avg_decision_time = (total_duration_seconds // duration_count) if duration_count > 0 else 0
    sla_target_seconds = 14400  # 4 hours
    sla_breaches = duration_count - sum(
        1 for inv in reviewed_invoices.all() if inv.review_duration_seconds <= sla_target_seconds
    ) if duration_count > 0 else 0

    correction_rate = round((corrections / decisions * 100), 1) if decisions > 0 else 0.0
    rejection_rate = round((rejections / decisions * 100), 1) if decisions > 0 else 0.0

    # Tenure
    tenure_days = (datetime.utcnow() - reviewer.created_at).days

    return {
        "reviewer_id": str(reviewer_id),
        "reviewer_name": actor_name,
        "period_days": period_days,
        "decisions_in_period": decisions,
        "avg_decision_time_seconds": avg_decision_time,
        "sla_target_seconds": sla_target_seconds,
        "sla_breach_count": sla_breaches,
        # correction_rate is a PIPELINE HEALTH signal, not a productivity metric.
        # High values indicate OCR/AI extraction quality gaps.
        "correction_rate_percent": correction_rate,
        "corrections_by_field": corrections_by_field,
        "rejection_rate_percent": rejection_rate,
        "tenure_days": tenure_days,
        "last_login": reviewer.last_login.isoformat() if reviewer.last_login else None,
        "is_active": reviewer.is_active,
    }


@router.get("/analytics")
def get_reviewer_analytics(
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Admin", "Auditor"]))
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    
    query = db.query(Invoice)
    if org_id:
        query = query.filter(Invoice.organization_id == org_id)
        
    invoices = query.all()
    settings = db.query(Settings).first()
    threshold = settings.ai_confidence_threshold if settings else 0.85

    pending_count = 0
    reviewed_today = 0
    total_review_time = 0
    reviewed_with_time_count = 0
    total_confidence = 0.0
    confidence_count = 0
    low_confidence_count = 0
    corrections_count = 0
    returned_count = 0
    rejected_count = 0

    error_distribution = {
        "OCR Error": 0,
        "AI Extraction Error": 0,
        "GST Corrected": 0,
        "Amount Corrected": 0,
        "Vendor Corrected": 0,
        "Missing PO": 0,
        "Other": 0
    }

    for inv in invoices:
        status_str = inv.workflow_status.value if hasattr(inv.workflow_status, "value") else str(inv.workflow_status)
        if status_str in ["pending_review", "validation_failed"]:
            pending_count += 1
            
        conf = inv.confidence_score if inv.confidence_score is not None else 1.0
        total_confidence += conf
        confidence_count += 1
        if conf < threshold:
            low_confidence_count += 1
            
        # Metrics based on audit logs
        logs = db.query(AuditLog).filter(AuditLog.invoice_id == inv.id).all()
        for log in logs:
            if log.action == "FIELD_MANUALLY_CORRECTED":
                corrections_count += 1
                details = log.details or {}
                # Map reason/error classes if available
                field = details.get("field", "")
                if "gstin" in field.lower():
                    error_distribution["GST Corrected"] += 1
                elif "amount" in field.lower() or "value" in field.lower():
                    error_distribution["Amount Corrected"] += 1
                elif "vendor" in field.lower() or "seller" in field.lower():
                    error_distribution["Vendor Corrected"] += 1
                else:
                    error_distribution["AI Extraction Error"] += 1
            elif log.action == "INVOICE_SUBMITTED_FOR_APPROVAL":
                # Check if submitted today
                if log.timestamp.date() == date.today():
                    reviewed_today += 1
            elif log.action == "INVOICE_REJECTED":
                rejected_count += 1
                if log.timestamp.date() == date.today():
                    returned_count += 1

        if inv.review_duration_seconds and inv.review_duration_seconds > 0:
            total_review_time += inv.review_duration_seconds
            reviewed_with_time_count += 1

    avg_time = (total_review_time / reviewed_with_time_count) if reviewed_with_time_count > 0 else 240
    avg_accuracy = (total_confidence / confidence_count) if confidence_count > 0 else 0.92

    return {
        "pending_reviews": pending_count,
        "reviewed_today": reviewed_today,
        "avg_review_time_seconds": int(avg_time),
        "ai_accuracy_percent": int(avg_accuracy * 100),
        "reviewer_corrections": corrections_count,
        "low_confidence_percent": int((low_confidence_count / confidence_count) * 100) if confidence_count > 0 else 0,
        "common_errors": error_distribution,
        "returned_invoices": returned_count,
        "rejected_invoices": rejected_count
    }

@router.post("/invoices/{invoice_id}/reviewer-submit")
def reviewer_submit(
    invoice_id: int,
    request: ReviewerSubmitRequest,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Admin"]))
):
    try:
        return _reviewer_submit_impl(invoice_id, request, db, current_user)
    except Exception as e:
        with open("/tmp/last_submission_error.txt", "w") as f:
            f.write(f"ERROR: {str(e)}\n")
            if hasattr(e, "detail"):
                f.write(f"DETAIL: {getattr(e, 'detail')}\n")
        raise

def _reviewer_submit_impl(
    invoice_id: int,
    request: ReviewerSubmitRequest,
    db: Session,
    current_user
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if org_id and invoice.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized organization access")

    settings = db.query(Settings).first()
    
    # 1. Validation checklist item gates
    required_checklist = settings.reviewer_checklist_items if settings else []
    for item in required_checklist:
        if not request.checklist_completed.get(item, False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Checklist item not verified: '{item}'"
            )

    # 2. Mandatory fields check
    required_fields = settings.rules_required_fields if settings else {}
    for field, is_required in required_fields.items():
        if is_required and getattr(invoice, field, None) in [None, "", 0.0]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mandatory field cannot be empty: {field.replace('_', ' ').title()}"
            )

    # 3. Comment requirements on edits
    has_edits = len(request.updates) > 0
    force_comments = settings.reviewer_comment_requirements.get("force_on_edits", True) if settings else True
    if has_edits and force_comments:
        if not request.comments and not request.free_text_comment.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comments/reasons are mandatory when modifying extraction fields."
            )

    # Apply manual updates
    confidence_before = invoice.confidence_score or 1.0
    for field, val in request.updates.items():
        if field == "items" and isinstance(val, list):
            from app.models.invoice_item import InvoiceItem
            old_items = [{"description": it.description, "quantity": it.quantity, "unit_price": it.unit_price} for it in invoice.items]
            db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).delete()
            for it_idx, it_data in enumerate(val):
                item_obj = InvoiceItem(
                    invoice_id=invoice.id,
                    description=it_data.get("description"),
                    quantity=float(it_data.get("quantity") or 0.0),
                    unit_price=float(it_data.get("unit_price") or 0.0),
                    total_amount=float(it_data.get("total_amount") or 0.0),
                    gst_rate=float(it_data.get("gst_rate") or 0.0),
                    hsn_code=it_data.get("hsn_code"),
                    item_number=it_data.get("item_number") or (it_idx + 1)
                )
                db.add(item_obj)
            db.add(AuditLog(
                invoice_id=invoice.id,
                organization_id=invoice.organization_id,
                action="LINE_ITEMS_MANUALLY_CORRECTED",
                status_before=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else str(invoice.workflow_status),
                status_after="pending_approval",
                performed_by=current_user.name or current_user.email,
                details={
                    "field": "items",
                    "original_value": str(old_items),
                    "corrected_value": str(val),
                    "reasons": request.comments,
                    "comment": request.free_text_comment,
                    "confidence_before": confidence_before,
                    "confidence_after": 1.0
                }
            ))
        elif hasattr(invoice, field):
            old = getattr(invoice, field)
            if field == "invoice_date" and isinstance(val, str) and val.strip():
                try:
                    from datetime import datetime
                    val = datetime.strptime(val.strip(), "%Y-%m-%d").date()
                except Exception as date_err:
                    print(f"Failed to parse invoice_date string in reviewer_submit {val}: {date_err}", flush=True)
            if old != val:
                setattr(invoice, field, val)
                # Log edit
                db.add(AuditLog(
                    invoice_id=invoice.id,
                    organization_id=invoice.organization_id,
                    action="FIELD_MANUALLY_CORRECTED",
                    status_before=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else str(invoice.workflow_status),
                    status_after="pending_approval",
                    performed_by=current_user.name or current_user.email,
                    details={
                        "field": field,
                        "original_value": str(old),
                        "corrected_value": str(val),
                        "reasons": request.comments,
                        "comment": request.free_text_comment,
                        "confidence_before": confidence_before,
                        "confidence_after": 1.0
                    }
                ))

    # Transition state to pending_approval
    status_before = invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else str(invoice.workflow_status)
    invoice.workflow_status = InvoiceWorkflowStatus.pending_approval
    invoice.reviewer_checklist_completed = request.checklist_completed
    invoice.reviewer_confidence_before = confidence_before
    invoice.reviewer_confidence_after = 1.0
    invoice.review_duration_seconds = request.duration_seconds
    
    # Track submission event in AuditLog
    db.add(AuditLog(
        invoice_id=invoice.id,
        organization_id=invoice.organization_id,
        action="INVOICE_SUBMITTED_FOR_APPROVAL",
        status_before=status_before,
        status_after="pending_approval",
        performed_by=current_user.name or current_user.email,
        details={
            "reasons": request.comments,
            "comment": request.free_text_comment,
            "duration_seconds": request.duration_seconds
        }
    ))

    db.commit()
    db.refresh(invoice)
    return invoice

@router.post("/invoices/{invoice_id}/reviewer-reject")
def reviewer_reject(
    invoice_id: int,
    request: ReviewerRejectRequest,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Reviewer", "Admin"]))
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if org_id and invoice.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized organization access")

    if not request.predefined_reasons and not request.free_text_reason.strip():
        raise HTTPException(status_code=400, detail="Rejection reasons/comments are mandatory.")

    settings = db.query(Settings).first()
    
    # Return to vendor logic trace (no hardcoded credentials/endpoints)
    comms_trace = None
    if request.return_to_vendor and settings and settings.reviewer_return_to_vendor_enabled:
        comms_trace = {
            "channel": "Email Notification Provider",
            "recipient": f"vendor_clarifications@{invoice.seller_name.lower().replace(' ', '')}.com",
            "payload": {
                "invoice_number": invoice.invoice_number,
                "reasons": request.predefined_reasons,
                "comment": request.free_text_reason
            },
            "status": "QUEUED"
        }

    status_before = invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else str(invoice.workflow_status)
    invoice.workflow_status = InvoiceWorkflowStatus.rejected
    
    db.add(AuditLog(
        invoice_id=invoice.id,
        organization_id=invoice.organization_id,
        action="INVOICE_REJECTED",
        status_before=status_before,
        status_after="rejected",
        performed_by=current_user.name or current_user.email,
        details={
            "reasons": request.predefined_reasons,
            "comment": request.free_text_reason,
            "communication_provider": comms_trace
        }
    ))

    db.commit()
    db.refresh(invoice)
    return invoice
