from fastapi import APIRouter, Depends, HTTPException, Response, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db
from app.models.settings import Settings
from app.models.approval import ApprovalRule
from app.schemas.settings import (
    SettingsResponse, SettingsCreate, GSTConfigUpdate, GSTConfigResponse,
    POMatchConfigUpdate, POMatchConfigResponse,
    ApprovalRuleCreate, ApprovalRuleUpdate, ApprovalRuleResponse
)

from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
    dependencies=[Depends(get_current_user)]
)


from app.models.user import User

def get_or_create_settings(db: Session, organization_id=None) -> Settings:
    return Settings.get_for_organization(db, organization_id)

def resolve_org_id(current_user: User, organization_id: Optional[UUID] = None) -> Optional[UUID]:
    if current_user.role == "Super Admin":
        return organization_id
    return current_user.organization_id


@router.get("/", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: Optional[UUID] = Query(None)
):
    return get_or_create_settings(db, resolve_org_id(current_user, organization_id))


@router.put("/", response_model=SettingsResponse)
def update_settings(
    settings_in: SettingsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Super Admin"])),
    organization_id: Optional[UUID] = Query(None)
):
    settings = get_or_create_settings(db, resolve_org_id(current_user, organization_id))

    for field, value in settings_in.dict(exclude_unset=True).items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings


# ── GST compliance parameter endpoints ────────────────────────────────────────

@router.get("/gst-config", response_model=GSTConfigResponse)
def get_gst_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: Optional[UUID] = Query(None)
):
    """Return current GST compliance parameters (tolerance, reconciliation %, IRN rules)."""
    return get_or_create_settings(db, resolve_org_id(current_user, organization_id))


@router.put("/gst-config", response_model=GSTConfigResponse)
def update_gst_config(
    payload: GSTConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Super Admin"])),
    organization_id: Optional[UUID] = Query(None)
):
    """Partial update of GST compliance parameters."""
    settings = get_or_create_settings(db, resolve_org_id(current_user, organization_id))

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields provided for update")

    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings


# ── PO Match compliance parameter endpoints ───────────────────────────────────

@router.get("/po-match-config", response_model=POMatchConfigResponse)
def get_po_match_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: Optional[UUID] = Query(None)
):
    """Return current PO Match compliance parameters."""
    return get_or_create_settings(db, resolve_org_id(current_user, organization_id))


@router.put("/po-match-config", response_model=POMatchConfigResponse)
def update_po_match_config(
    payload: POMatchConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Super Admin"])),
    organization_id: Optional[UUID] = Query(None)
):
    """Partial update of PO Match compliance parameters."""
    settings = get_or_create_settings(db, resolve_org_id(current_user, organization_id))

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields provided for update")

    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings





# ── Approval Rules CRUD Endpoints ───────────────────────────────────────────

@router.get("/approval-rules", response_model=List[ApprovalRuleResponse])
def list_approval_rules(
    db: Session = Depends(get_db),
    current_user=Depends(RoleChecker(["Admin", "Super Admin"])),
):
    """List all approval routing rules."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    query = db.query(ApprovalRule)
    if org_id:
        query = query.filter((ApprovalRule.organization_id == org_id) | (ApprovalRule.organization_id == None))
    return query.order_by(ApprovalRule.min_amount.asc()).all()


@router.post("/approval-rules", response_model=ApprovalRuleResponse, status_code=status.HTTP_201_CREATED)
def create_approval_rule(
    payload: ApprovalRuleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(RoleChecker(["Admin", "Super Admin"])),
):
    """Create a new approval routing rule."""
    try:
        rule = ApprovalRule(**payload.model_dump())
        if current_user.role != "Super Admin":
            rule.organization_id = current_user.organization_id
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create rule: {str(e)}")


@router.put("/approval-rules/{id}", response_model=ApprovalRuleResponse)
def update_approval_rule(
    id: int,
    payload: ApprovalRuleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(RoleChecker(["Admin", "Super Admin"])),
):
    """Update an existing approval routing rule."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    query = db.query(ApprovalRule).filter(ApprovalRule.id == id)
    if org_id:
        query = query.filter(ApprovalRule.organization_id == org_id)
    rule = query.first()
    if not rule:
        raise HTTPException(status_code=404, detail="Approval rule not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)

    try:
        db.commit()
        db.refresh(rule)
        return rule
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update rule: {str(e)}")


@router.delete("/approval-rules/{id}", status_code=status.HTTP_200_OK)
def delete_approval_rule(
    id: int,
    db: Session = Depends(get_db),
    current_user=Depends(RoleChecker(["Admin", "Super Admin"])),
):
    """Delete an approval routing rule."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    query = db.query(ApprovalRule).filter(ApprovalRule.id == id)
    if org_id:
        query = query.filter(ApprovalRule.organization_id == org_id)
    rule = query.first()
    if not rule:
        raise HTTPException(status_code=404, detail="Approval rule not found")

    try:
        db.delete(rule)
        db.commit()
        return {"success": True, "message": "Approval rule deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to delete rule: {str(e)}")
