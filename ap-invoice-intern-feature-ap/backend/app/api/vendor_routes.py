"""Vendor API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.models.user import User
from app.models.vendor import Vendor
from app.models.invoice import Invoice
from app.models.audit_log import AuditLog
from app.dependencies import get_current_user, RoleChecker

router = APIRouter()

class VendorCreateRequest(BaseModel):
    name: str
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None

class VendorResponse(BaseModel):
    id: int
    name: str
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None

    class Config:
        from_attributes = True

class MapVendorRequest(BaseModel):
    vendor_id: int

@router.get("/vendors", response_model=List[VendorResponse])
def get_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all vendors belonging to the user's organization."""
    org_id = current_user.organization_id
    if not org_id:
        return []
    return db.query(Vendor).filter(Vendor.organization_id == org_id).all()

@router.post("/vendors", response_model=VendorResponse)
def create_vendor(
    request: VendorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Approver"])),
):
    """Create a new vendor with bank details."""
    org_id = current_user.organization_id
    if not org_id:
        raise HTTPException(status_code=400, detail="User must belong to an organization.")
    
    # Check if vendor with same name exists
    existing = db.query(Vendor).filter(
        Vendor.name == request.name,
        Vendor.organization_id == org_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vendor with this name already exists.")

    vendor = Vendor(
        name=request.name,
        bank_account_number=request.bank_account_number,
        ifsc_code=request.ifsc_code,
        bank_name=request.bank_name,
        organization_id=org_id
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor

@router.post("/invoices/{invoice_id}/map-vendor")
def map_vendor_to_invoice(
    invoice_id: int,
    request: MapVendorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Approver"])),
):
    """Map a vendor to an invoice, copying the vendor's bank details to the invoice."""
    org_id = current_user.organization_id
    
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if org_id and invoice.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Unauthorized organization access")

    vendor = db.query(Vendor).filter(Vendor.id == request.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if org_id and vendor.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Vendor belongs to a different organization")

    # Update invoice fields
    invoice.vendor_id = vendor.id
    invoice.bank_account_number = vendor.bank_account_number
    invoice.ifsc_code = vendor.ifsc_code
    invoice.bank_name = vendor.bank_name
    invoice.seller_name = vendor.name

    # Add audit log
    db.add(AuditLog(
        invoice_id=invoice.id,
        organization_id=invoice.organization_id,
        action="INVOICE_VENDOR_MAPPED",
        status_before=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else str(invoice.workflow_status),
        status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else str(invoice.workflow_status),
        performed_by=current_user.name or current_user.email,
        details={
            "vendor_id": vendor.id,
            "vendor_name": vendor.name,
            "bank_account_number": vendor.bank_account_number,
            "ifsc_code": vendor.ifsc_code
        }
    ))
    db.commit()
    db.refresh(invoice)
    
    return {
        "success": True,
        "invoice_id": invoice.id,
        "vendor_id": invoice.vendor_id,
        "bank_account_number": invoice.bank_account_number,
        "ifsc_code": invoice.ifsc_code,
        "bank_name": invoice.bank_name,
        "seller_name": invoice.seller_name
    }
