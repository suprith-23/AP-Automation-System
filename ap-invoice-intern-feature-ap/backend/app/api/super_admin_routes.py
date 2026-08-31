from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.invoice import Invoice
from app.dependencies import get_current_user, RoleChecker
from app.services.audit_log_service import create_audit_log

router = APIRouter(
    prefix="/super-admin",
    tags=["Super Admin Operations"],
    dependencies=[Depends(RoleChecker(["Super Admin"]))]
)

# --- Pydantic Schemas ---
class SupportSessionInit(BaseModel):
    organization_id: UUID
    reason: str
    ticket_reference: Optional[str] = None

# --- Impersonation / Support Mode ---
@router.post("/support-session/initiate", status_code=status.HTTP_200_OK)
def initiate_support_session(
    data: SupportSessionInit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log the initiation of a support/impersonation session for audit compliance."""
    org = db.query(Organization).filter(Organization.id == data.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    create_audit_log(
        db=db,
        action="SUPPORT_ACCESS_INITIATED",
        performed_by=current_user.email,
        organization_id=data.organization_id,
        details={
            "super_admin_email": current_user.email,
            "target_organization_id": str(data.organization_id),
            "target_organization_name": org.name,
            "reason": data.reason,
            "ticket_reference": data.ticket_reference,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    return {"message": "Support impersonation session initiated and logged successfully"}

@router.post("/support-session/terminate/{org_id}", status_code=status.HTTP_200_OK)
def terminate_support_session(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log the termination of a support/impersonation session."""
    create_audit_log(
        db=db,
        action="SUPPORT_ACCESS_TERMINATED",
        performed_by=current_user.email,
        organization_id=org_id,
        details={
            "super_admin_email": current_user.email,
            "target_organization_id": str(org_id),
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    return {"message": "Support session terminated and logged successfully"}

# --- Cross-Tenant Search ---
@router.get("/search", status_code=status.HTTP_200_OK)
def cross_tenant_search(
    query: str = Query(..., min_length=1),
    category: str = Query("all", description="all, organizations, users, invoices"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search across tenant boundaries. Logs access for security compliance auditing.
    """
    # Write audit log for the search query execution
    create_audit_log(
        db=db,
        action="CROSS_TENANT_SEARCH",
        performed_by=current_user.email,
        details={
            "query": query,
            "category": category,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

    results = {
        "organizations": [],
        "users": [],
        "invoices": []
    }

    search_pattern = f"%{query}%"

    if category in ["all", "organizations"]:
        orgs = db.query(Organization).filter(
            (Organization.name.ilike(search_pattern)) | 
            (Organization.code.ilike(search_pattern))
        ).limit(20).all()
        results["organizations"] = [
            {"id": str(o.id), "name": o.name, "code": o.code, "status": o.status}
            for o in orgs
        ]

    if category in ["all", "users"]:
        users = db.query(User).filter(
            (User.name.ilike(search_pattern)) | 
            (User.email.ilike(search_pattern))
        ).limit(20).all()
        results["users"] = [
            {
                "id": str(u.id),
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "organization_name": u.organization.name if u.organization else "Global",
                "status": u.status
            }
            for u in users
        ]

    if category in ["all", "invoices"]:
        # Query invoices and join organization to get name
        invoices = db.query(Invoice).filter(
            (Invoice.invoice_number.ilike(search_pattern)) |
            (Invoice.seller_name.ilike(search_pattern))
        ).limit(20).all()
        results["invoices"] = [
            {
                "id": i.id,
                "invoice_number": i.invoice_number,
                "seller_name": i.seller_name,
                "total_amount": float(i.total_amount) if i.total_amount else 0.0,
                "status": i.status,
                "organization_name": i.organization.name if i.organization else "Unknown"
            }
            for i in invoices
        ]

    return results

# --- Tenure Rollup Metrics ---
@router.get("/tenure-metrics", status_code=status.HTTP_200_OK)
def get_user_tenure_metrics(
    db: Session = Depends(get_db)
):
    """
    Get user tenure and statistics aggregated by organization.
    """
    orgs = db.query(Organization).filter(Organization.status != "Deleted").all()
    metrics = []

    now = datetime.utcnow()
    dormant_limit = now - timedelta(days=90)

    for org in orgs:
        users = db.query(User).filter(
            User.organization_id == org.id,
            User.status != "Deleted"
        ).all()

        active_users = [u for u in users if u.is_active]
        roles_breakdown = {}
        total_tenure_days = 0
        dormant_count = 0

        for u in active_users:
            # Roles breakdown
            roles_breakdown[u.role] = roles_breakdown.get(u.role, 0) + 1
            
            # Tenure calculation
            tenure = now - u.created_at
            total_tenure_days += tenure.days

            # Dormant calculation
            is_dormant = False
            if u.last_login:
                if u.last_login < dormant_limit:
                    is_dormant = True
            else:
                if u.created_at < dormant_limit:
                    is_dormant = True
            
            if is_dormant:
                dormant_count += 1

        avg_tenure = (total_tenure_days / len(active_users)) if len(active_users) > 0 else 0.0

        metrics.append({
            "organization_id": str(org.id),
            "organization_name": org.name,
            "organization_code": org.code,
            "active_users_count": len(active_users),
            "dormant_users_count": dormant_count,
            "avg_tenure_days": round(avg_tenure, 1),
            "roles_breakdown": roles_breakdown,
            "last_activity": max([u.last_login for u in users if u.last_login]) if any(u.last_login for u in users) else None
        })

    return metrics
