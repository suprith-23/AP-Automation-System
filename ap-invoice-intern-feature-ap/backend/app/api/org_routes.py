from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.models.invoice import Invoice
from app.dependencies import get_current_user, RoleChecker
from app.services.audit_log_service import create_audit_log
from app.core.security.hashing import hash_password

router = APIRouter(
    prefix="/organizations",
    tags=["Organizations"],
    dependencies=[Depends(RoleChecker(["Super Admin"]))]
)

# --- Pydantic Schemas ---
class OrganizationCreate(BaseModel):
    name: str
    code: str
    gst_number: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class OrganizationUpdate(BaseModel):
    name: str
    gst_number: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    code: str
    gst_number: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    admin_assigned: Optional[str] = None

    class Config:
        from_attributes = True

class ResetAdminPasswordRequest(BaseModel):
    new_password: str

# --- Endpoints ---

@router.get("/", response_model=List[OrganizationResponse])
def list_organizations(db: Session = Depends(get_db)):
    """List all registered organizations (excluding Deleted status if desired, or return all)."""
    return db.query(Organization).filter(Organization.status != "Deleted").all()

@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_org(data: OrganizationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if organization code already exists
    existing = db.query(Organization).filter(Organization.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Organization code already exists")

    org = Organization(
        name=data.name,
        code=data.code,
        gst_number=data.gst_number,
        address=data.address,
        email=data.email,
        phone=data.phone,
        status="Active",
        created_by=current_user.email
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    # Seed default Settings for the new organization
    from app.models.settings import Settings
    Settings.get_for_organization(db, org.id)

    create_audit_log(
        db=db,
        action="ORGANIZATION_CREATED",
        performed_by=current_user.name,
        details={"org_id": str(org.id), "org_name": org.name, "org_code": org.code}
    )

    return org

@router.put("/{org_id}", response_model=OrganizationResponse)
def update_org(org_id: UUID, data: OrganizationUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organization).filter(Organization.id == org_id, Organization.status != "Deleted").first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    old_values = {"name": org.name, "gst_number": org.gst_number, "address": org.address, "email": org.email, "phone": org.phone}
    
    org.name = data.name
    org.gst_number = data.gst_number
    org.address = data.address
    org.email = data.email
    org.phone = data.phone

    db.commit()
    db.refresh(org)

    create_audit_log(
        db=db,
        action="ORGANIZATION_UPDATED",
        performed_by=current_user.name,
        details={
            "org_id": str(org.id),
            "old_values": old_values,
            "new_values": data.dict()
        }
    )

    return org

@router.post("/{org_id}/suspend", response_model=OrganizationResponse)
def suspend_org(org_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organization).filter(Organization.id == org_id, Organization.status != "Deleted").first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.status = "Suspended"
    db.commit()
    db.refresh(org)

    create_audit_log(
        db=db,
        action="ORGANIZATION_SUSPENDED",
        performed_by=current_user.name,
        details={"org_id": str(org.id), "org_name": org.name}
    )

    return org

@router.post("/{org_id}/activate", response_model=OrganizationResponse)
def activate_org(org_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organization).filter(Organization.id == org_id, Organization.status != "Deleted").first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.status = "Active"
    db.commit()
    db.refresh(org)

    create_audit_log(
        db=db,
        action="ORGANIZATION_ACTIVATED",
        performed_by=current_user.name,
        details={"org_id": str(org.id), "org_name": org.name}
    )

    return org

@router.delete("/{org_id}")
def delete_org(org_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organization).filter(Organization.id == org_id, Organization.status != "Deleted").first()
    if not org:
        raise HTTPException(status_code=44, detail="Organization not found")

    # Soft delete
    org.status = "Deleted"
    db.commit()

    create_audit_log(
        db=db,
        action="ORGANIZATION_DELETED",
        performed_by=current_user.name,
        details={"org_id": str(org_id), "org_name": org.name}
    )

    return {"message": "Organization soft-deleted successfully"}

@router.get("/stats/all", response_model=Dict[str, Any])
def get_all_orgs_stats(db: Session = Depends(get_db)):
    """Retrieve aggregate statistics across all organizations."""
    total_organizations = db.query(Organization).filter(Organization.status != "Deleted").count()
    total_users = db.query(User).count()
    total_invoices = db.query(Invoice).count()
    
    # Calculate some processing metrics
    approved_invoices = db.query(Invoice).filter(Invoice.status == "approved").count()
    success_rate = (approved_invoices / total_invoices * 100) if total_invoices > 0 else 100.0

    return {
        "total_organizations": total_organizations,
        "total_users": total_users,
        "total_invoices": total_invoices,
        "processing_success_rate": success_rate,
        "storage_usage_mb": round(total_invoices * 0.15, 2),  # Mock storage usage (e.g., 150KB per invoice)
        "total_api_requests": total_invoices * 4  # Mock API requests
    }

@router.get("/{org_id}/stats", response_model=Dict[str, Any])
def get_org_stats(org_id: UUID, db: Session = Depends(get_db)):
    """Retrieve organization-specific stats."""
    org = db.query(Organization).filter(Organization.id == org_id, Organization.status != "Deleted").first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user_count = db.query(User).filter(User.organization_id == org_id).count()
    invoice_count = db.query(Invoice).filter(Invoice.organization_id == org_id).count()
    approved_count = db.query(Invoice).filter(Invoice.organization_id == org_id, Invoice.status == "approved").count()
    success_rate = (approved_count / invoice_count * 100) if invoice_count > 0 else 100.0

    return {
        "organization_id": org_id,
        "organization_name": org.name,
        "user_count": user_count,
        "invoice_count": invoice_count,
        "processing_success_rate": success_rate,
        "storage_usage_mb": round(invoice_count * 0.15, 2)
    }

@router.post("/{org_id}/reset-admin-password")
def reset_admin_password(org_id: UUID, data: ResetAdminPasswordRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find organization admin
    admin = db.query(User).filter(User.organization_id == org_id, User.role == "Admin").first()
    if not admin:
        raise HTTPException(status_code=404, detail="Organization admin not found")

    admin.password_hash = hash_password(data.new_password)
    db.commit()

    create_audit_log(
        db=db,
        action="PASSWORD_RESET",
        performed_by=current_user.name,
        details={"user_email": admin.email, "role": admin.role}
    )

    return {"message": "Admin password reset successfully"}

@router.post("/{org_id}/admins")
def create_org_admin(org_id: UUID, name: str, email: str, password: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    org = db.query(Organization).filter(Organization.id == org_id, Organization.status != "Deleted").first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check if admin already exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    admin_user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role="Admin",
        designation="Org Admin",
        status="Active",
        is_active=True,
        organization_id=org_id
    )
    db.add(admin_user)
    
    # Update org status with assigned admin
    org.admin_assigned = email
    db.commit()

    create_audit_log(
        db=db,
        action="ADMIN_CREATED",
        performed_by=current_user.name,
        details={"admin_email": email, "org_name": org.name}
    )

    return {"message": "Admin assigned to organization successfully", "admin_email": email}
