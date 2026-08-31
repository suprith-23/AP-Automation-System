"""CRUD API for TDS calculation rules.

Endpoints:
  GET    /api/v1/settings/tds-rules         — list rules (tenant scoped)
  POST   /api/v1/settings/tds-rules         — create a new rule
  PUT    /api/v1/settings/tds-rules/{id}    — update an existing rule
  DELETE /api/v1/settings/tds-rules/{id}    — delete a rule
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.tds import TDSRule
from app.schemas.tds_rule import (
    TDSRuleCreate,
    TDSRuleUpdate,
    TDSRuleResponse
)
from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    prefix="/settings/tds-rules",
    tags=["TDS Rules Config"],
    dependencies=[Depends(RoleChecker(["Admin", "Super Admin"]))]
)

@router.get("", response_model=List[TDSRuleResponse])
def list_tds_rules(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """List TDS rules. For Admins, returns organization-scoped rules + fallback global rules (org_id is null)."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    
    # Query rules matching the user's organization OR global fallback rules (where organization_id is NULL)
    if org_id:
        rules = db.query(TDSRule).filter(
            (TDSRule.organization_id == org_id) | (TDSRule.organization_id == None)
        ).order_by(TDSRule.section_code).all()
    else:
        rules = db.query(TDSRule).order_by(TDSRule.section_code).all()

    # Parse JSON strings to lists for the Pydantic schema
    response_rules = []
    for r in rules:
        try:
            v_cats = json.loads(r.vendor_categories) if r.vendor_categories else []
        except Exception:
            v_cats = []
        try:
            e_cats = json.loads(r.expense_categories) if r.expense_categories else []
        except Exception:
            e_cats = []
            
        response_rules.append(
            TDSRuleResponse(
                id=r.id,
                organization_id=str(r.organization_id) if r.organization_id else None,
                section_code=r.section_code,
                description=r.description,
                rate_with_pan=r.rate_with_pan,
                rate_without_pan=r.rate_without_pan,
                single_threshold=r.single_threshold,
                aggregate_threshold=r.aggregate_threshold,
                vendor_categories=v_cats,
                expense_categories=e_cats,
                effective_from=r.effective_from,
                effective_to=r.effective_to
            )
        )
    return response_rules

@router.post("", response_model=TDSRuleResponse, status_code=201)
def create_tds_rule(payload: TDSRuleCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Create a new TDS rule for the current user's organization."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    
    rule = TDSRule(
        organization_id=org_id,
        section_code=payload.section_code,
        description=payload.description,
        rate_with_pan=payload.rate_with_pan,
        rate_without_pan=payload.rate_without_pan,
        single_threshold=payload.single_threshold,
        aggregate_threshold=payload.aggregate_threshold,
        vendor_categories=json.dumps(payload.vendor_categories or []),
        expense_categories=json.dumps(payload.expense_categories or []),
        effective_from=payload.effective_from,
        effective_to=payload.effective_to
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return TDSRuleResponse(
        id=rule.id,
        organization_id=str(rule.organization_id) if rule.organization_id else None,
        section_code=rule.section_code,
        description=rule.description,
        rate_with_pan=rule.rate_with_pan,
        rate_without_pan=rule.rate_without_pan,
        single_threshold=rule.single_threshold,
        aggregate_threshold=rule.aggregate_threshold,
        vendor_categories=payload.vendor_categories or [],
        expense_categories=payload.expense_categories or [],
        effective_from=rule.effective_from,
        effective_to=rule.effective_to
    )

@router.put("/{rule_id}", response_model=TDSRuleResponse)
def update_tds_rule(rule_id: int, payload: TDSRuleUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Update an existing TDS rule."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    
    rule = db.query(TDSRule).filter(TDSRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="TDS Rule not found")
        
    # Enforce tenant isolation
    if current_user.role != "Super Admin" and rule.organization_id != org_id:
         raise HTTPException(status_code=403, detail="Not authorized to edit this rule")
         
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "vendor_categories":
            setattr(rule, field, json.dumps(value or []))
        elif field == "expense_categories":
            setattr(rule, field, json.dumps(value or []))
        else:
            setattr(rule, field, value)
            
    db.commit()
    db.refresh(rule)
    
    try:
        v_cats = json.loads(rule.vendor_categories) if rule.vendor_categories else []
    except Exception:
        v_cats = []
    try:
        e_cats = json.loads(rule.expense_categories) if rule.expense_categories else []
    except Exception:
        e_cats = []
        
    return TDSRuleResponse(
        id=rule.id,
        organization_id=str(rule.organization_id) if rule.organization_id else None,
        section_code=rule.section_code,
        description=rule.description,
        rate_with_pan=rule.rate_with_pan,
        rate_without_pan=rule.rate_without_pan,
        single_threshold=rule.single_threshold,
        aggregate_threshold=rule.aggregate_threshold,
        vendor_categories=v_cats,
        expense_categories=e_cats,
        effective_from=rule.effective_from,
        effective_to=rule.effective_to
    )

@router.delete("/{rule_id}", status_code=204)
def delete_tds_rule(rule_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Remove a TDS Rule."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    
    rule = db.query(TDSRule).filter(TDSRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="TDS Rule not found")
        
    # Enforce tenant isolation
    if current_user.role != "Super Admin" and rule.organization_id != org_id:
         raise HTTPException(status_code=403, detail="Not authorized to delete this rule")
         
    db.delete(rule)
    db.commit()
