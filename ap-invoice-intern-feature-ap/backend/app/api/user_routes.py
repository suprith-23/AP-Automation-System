from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.schemas.user import UserCreate, UserResponse
from app.core.security.hashing import hash_password
from app.dependencies import get_current_user, RoleChecker
from app.services.audit_log_service import create_audit_log

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

class PasswordResetRequest(BaseModel):
    new_password: str




@router.get("/", response_model=List[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role_filter: Optional[str] = Query(None, alias="role"),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """
    List users with tenant isolation.
    - Super Admin: sees all users.
    - Admin: sees only users belonging to their organization.
    - Others: not authorized.
    """
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to view users")

    query = db.query(User).filter(User.status != "Deleted")
    
    # Tenant Isolation
    if current_user.role == "Admin":
        query = query.filter(User.organization_id == current_user.organization_id)

    # Filters
    if role_filter:
        query = query.filter(User.role == role_filter)
    if status_filter:
        query = query.filter(User.status == status_filter)
    if search:
        query = query.filter((User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%")))

    # Pagination
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size).all()


@router.get("/stats")
def get_user_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get work stats (pending/finished tasks) for all users in the organization.
    Only accessible by Admin or Super Admin.
    """
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get users of the org
    query = db.query(User).filter(User.status != "Deleted")
    if current_user.role == "Admin":
        query = query.filter(User.organization_id == current_user.organization_id)
    users = query.all()

    from app.models.invoice import Invoice, InvoiceWorkflowStatus
    from app.models.payment import PaymentSchedule
    from app.models.invoice_item import InvoiceItem
    from app.models.audit_log import AuditLog

    results = []
    for u in users:
        pending_list = []
        finished_list = []
        
        if u.role == "Reviewer":
            # 1. Pending: explicitly assigned to them, or unassigned pending in organization
            p_invs = db.query(Invoice).filter(
                Invoice.assigned_reviewer_id == u.id,
                Invoice.workflow_status.in_([
                    InvoiceWorkflowStatus.validation_pending,
                    InvoiceWorkflowStatus.validation_failed,
                    InvoiceWorkflowStatus.pending_review
                ])
            ).all()
            
            if not p_invs and u.organization_id:
                p_invs = db.query(Invoice).filter(
                    Invoice.assigned_reviewer_id == None,
                    Invoice.organization_id == u.organization_id,
                    Invoice.workflow_status.in_([
                        InvoiceWorkflowStatus.validation_pending,
                        InvoiceWorkflowStatus.validation_failed,
                        InvoiceWorkflowStatus.pending_review
                    ])
                ).all()

            pending_list = [{
                "id": inv.id,
                "invoice_number": inv.invoice_number or f"ID-{inv.id}",
                "vendor": inv.seller_name or "Unknown",
                "amount": inv.total_invoice_value or 0.0,
                "status": inv.workflow_status.value
            } for inv in p_invs]

            # 2. Finished: check who performed the review action via AuditLogs
            f_logs = db.query(AuditLog).filter(
                AuditLog.performed_by.in_([u.name, u.email]),
                AuditLog.action.in_(["INVOICE_VALIDATED", "REVIEWER_VALIDATED", "INVOICE_APPROVED"])
            ).all()
            f_inv_ids = list(set([log.invoice_id for log in f_logs if log.invoice_id]))
            
            f_invs = []
            if f_inv_ids:
                f_invs = db.query(Invoice).filter(Invoice.id.in_(f_inv_ids)).all()

            finished_list = [{
                "id": inv.id,
                "invoice_number": inv.invoice_number or f"ID-{inv.id}",
                "vendor": inv.seller_name or "Unknown",
                "amount": inv.total_invoice_value or 0.0,
                "status": inv.workflow_status.value
            } for inv in f_invs]
            
        elif u.role == "Approver" or u.role == "Admin":
            # 1. Pending: explicitly assigned to them, or unassigned pending payment schedules in org
            p_scheds = db.query(PaymentSchedule).filter(
                PaymentSchedule.assigned_user == u.name,
                PaymentSchedule.status.in_(["Awaiting Scheduling", "Scheduled", "Queued", "Processing"])
            ).all()
            
            if not p_scheds and u.organization_id:
                p_scheds = db.query(PaymentSchedule).join(Invoice).filter(
                    PaymentSchedule.assigned_user == None,
                    Invoice.organization_id == u.organization_id,
                    PaymentSchedule.status.in_(["Awaiting Scheduling", "Scheduled", "Queued", "Processing"])
                ).all()

            pending_list = [{
                "id": s.id,
                "invoice_number": s.invoice.invoice_number if s.invoice else f"PAY-{s.id}",
                "vendor": s.invoice.seller_name if s.invoice else "Unknown",
                "amount": s.total_amount,
                "status": s.status
            } for s in p_scheds]

            # 2. Finished: check payment execution actions in audit logs
            f_logs = db.query(AuditLog).filter(
                AuditLog.performed_by.in_([u.name, u.email]),
                AuditLog.action.in_(["PAYMENT_COMPLETED", "GATEWAY_VERIFY_PAYMENT"])
            ).all()
            f_inv_ids = list(set([log.invoice_id for log in f_logs if log.invoice_id]))
            
            f_scheds = []
            if f_inv_ids:
                f_scheds = db.query(PaymentSchedule).filter(
                    PaymentSchedule.invoice_id.in_(f_inv_ids),
                    PaymentSchedule.status.in_(["Completed", "Reconciled"])
                ).all()

            finished_list = [{
                "id": s.id,
                "invoice_number": s.invoice.invoice_number if s.invoice else f"PAY-{s.id}",
                "vendor": s.invoice.seller_name if s.invoice else "Unknown",
                "amount": s.total_amount,
                "status": s.status
            } for s in f_scheds]

        results.append({
            "user_id": str(u.id),
            "name": u.name,
            "role": u.role,
            "pending_count": len(pending_list),
            "finished_count": len(finished_list),
            "pending_works": pending_list,
            "finished_works": finished_list
        })

    return results


@router.get("/pending", response_model=List[UserResponse])
def get_pending_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get users awaiting approval for the admin's organization.
    """
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = db.query(User).filter(User.status == "Pending Approval")
    
    if current_user.role == "Admin":
        query = query.filter(User.organization_id == current_user.organization_id)

    return query.all()


@router.post("/", response_model=UserResponse)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check if user email already exists
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")
    
    org_id = current_user.organization_id if current_user.role == "Admin" else user_in.organization_id

    db_user = User(
        name=user_in.name,
        email=user_in.email,
        role=user_in.role,
        designation=user_in.designation,
        status=user_in.status or "Active",
        is_active=user_in.is_active if user_in.is_active is not None else True,
        employee_id=user_in.employee_id,
        department=user_in.department,
        phone=user_in.phone,
        organization_id=org_id,
        password_hash=hash_password(user_in.password or "Password123!"),
        must_change_password=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    create_audit_log(
        db=db,
        action="USER_CREATED",
        performed_by=current_user.name,
        details={"created_email": db_user.email, "role": db_user.role, "status": "Success"}
    )
    
    return db_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Tenant check
    if current_user.role == "Admin" and db_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    old_role = db_user.role
    old_status = db_user.status
    
    db_user.name = user_in.name
    db_user.email = user_in.email
    db_user.role = user_in.role
    db_user.designation = user_in.designation
    
    if user_in.status:
        db_user.status = user_in.status
        if user_in.status == "Active":
            db_user.is_active = True
        elif user_in.status in ["Inactive", "Suspended", "Rejected"]:
            db_user.is_active = False

    if user_in.is_active is not None:
        db_user.is_active = user_in.is_active

    db_user.employee_id = user_in.employee_id
    db_user.department = user_in.department
    db_user.phone = user_in.phone
    
    if user_in.password:
        db_user.password_hash = hash_password(user_in.password)
        db_user.must_change_password = True
        
    db.commit()
    db.refresh(db_user)
    
    if old_role != db_user.role:
        create_audit_log(
            db=db,
            action="ROLE_CHANGED",
            performed_by=current_user.name,
            details={"user_email": db_user.email, "old_role": old_role, "new_role": db_user.role, "status": "Success"}
        )
    
    if old_status != db_user.status:
        create_audit_log(
            db=db,
            action="STATUS_CHANGED",
            performed_by=current_user.name,
            details={"user_email": db_user.email, "old_status": old_status, "new_status": db_user.status}
        )
        
    return db_user


@router.delete("/{user_id}")
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    # Tenant check
    if current_user.role == "Admin" and db_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    user_email = db_user.email
    db_user.status = "Deleted"
    db_user.is_active = False
    db.commit()
    
    create_audit_log(
        db=db,
        action="USER_DELETED",
        performed_by=current_user.name,
        details={"deleted_email": user_email, "status": "Success"}
    )
    
    return {"message": "User soft-deleted successfully"}


@router.post("/{user_id}/approve")
def approve_user(
    user_id: UUID,
    role: str = Query(..., description="Assigned role: Admin, Approver, Reviewer, or Auditor"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    ALLOWED_ROLES = ["Admin", "Approver", "Reviewer", "Auditor"]
    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Role must be one of: {', '.join(ALLOWED_ROLES)}"
        )

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if current_user.role == "Admin" and db_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db_user.role = role
    db_user.status = "Active"
    db_user.is_active = True
    db.commit()

    # Generate and send SET_PASSWORD OTP code to the approved user
    from app.services.otp_service import OTPService
    OTPService.create_and_send_otp(db, db_user.email, "SET_PASSWORD")

    create_audit_log(
        db=db,
        action="USER_APPROVED",
        performed_by=current_user.name,
        details={"user_email": db_user.email, "assigned_role": role}
    )
    return {"message": "User approved successfully"}



@router.post("/{user_id}/reject")
def reject_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if current_user.role == "Admin" and db_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db_user.status = "Rejected"
    db_user.is_active = False
    db.commit()

    # Send a rejection notification transactional email using Resend
    from app.services.email_service import EmailService
    subject = "Registration Request Rejected - AP Autoflow"
    html_content = EmailService.get_user_rejection_html(db_user.name)
    EmailService.send_email(db_user.email, subject, html_content)

    create_audit_log(
        db=db,
        action="USER_REJECTED",
        performed_by=current_user.name,
        details={"user_email": db_user.email}
    )
    return {"message": "User registration rejected"}


@router.post("/{user_id}/request-info")
def request_info(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if current_user.role == "Admin" and db_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db_user.status = "Info Requested"
    db_user.is_active = False
    db.commit()

    create_audit_log(
        db=db,
        action="STATUS_CHANGED",
        performed_by=current_user.name,
        details={"user_email": db_user.email, "new_status": "Info Requested"}
    )
    return {"message": "Information requested from user"}


@router.post("/{user_id}/reset-password")
def admin_reset_password(
    user_id: UUID,
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if current_user.role == "Admin" and db_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db_user.password_hash = hash_password(data.new_password)
    db_user.must_change_password = True
    db.commit()

    create_audit_log(
        db=db,
        action="PASSWORD_RESET",
        performed_by=current_user.name,
        details={"user_email": db_user.email}
    )
    return {"message": "User password reset successfully"}


@router.post("/{user_id}/deactivate")
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if current_user.role == "Admin" and db_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db_user.is_active = False
    db_user.status = "Inactive"
    db.commit()

    create_audit_log(
        db=db,
        action="STATUS_CHANGED",
        performed_by=current_user.name,
        details={"user_email": db_user.email, "new_status": "Inactive"}
    )
    return {"message": "User deactivated successfully"}


@router.post("/{user_id}/reactivate")
def reactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["Super Admin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if current_user.role == "Admin" and db_user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db_user.is_active = True
    db_user.status = "Active"
    db.commit()

    create_audit_log(
        db=db,
        action="STATUS_CHANGED",
        performed_by=current_user.name,
        details={"user_email": db_user.email, "new_status": "Active"}
    )
    return {"message": "User reactivated successfully"}
