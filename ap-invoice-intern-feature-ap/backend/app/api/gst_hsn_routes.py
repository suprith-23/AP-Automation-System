"""CRUD API for GST HSN rules (RCM and Blocked-ITC prefix lists).

Endpoints:
  GET    /api/v1/settings/gst-hsn-rules          — list rules (org-scoped + global fallback)
  POST   /api/v1/settings/gst-hsn-rules          — create a new rule
  DELETE /api/v1/settings/gst-hsn-rules/{id}     — delete a rule

Rule types:
  "RCM"         — Reverse Charge Mechanism applies to this HSN/SAC prefix
  "BLOCKED_ITC" — Input Tax Credit is blocked for this HSN/SAC prefix
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.gst_hsn_rule import GSTHsnRule
from app.schemas.gst_hsn_rule import GSTHsnRuleCreate, GSTHsnRuleResponse
from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    prefix="/settings/gst-hsn-rules",
    tags=["GST HSN Rules Config"],
    dependencies=[Depends(RoleChecker(["Admin", "Super Admin"]))],
)


@router.get("", response_model=List[GSTHsnRuleResponse])
def list_gst_hsn_rules(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List GST HSN rules.

    For Admins: returns org-scoped rules + global fallback rules (org_id is NULL).
    For Super Admin: returns all rules.
    """
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None

    if org_id:
        rules = (
            db.query(GSTHsnRule)
            .filter(
                (GSTHsnRule.organization_id == org_id)
                | (GSTHsnRule.organization_id == None)  # noqa: E711
            )
            .order_by(GSTHsnRule.rule_type, GSTHsnRule.hsn_prefix)
            .all()
        )
    else:
        rules = (
            db.query(GSTHsnRule)
            .order_by(GSTHsnRule.rule_type, GSTHsnRule.hsn_prefix)
            .all()
        )

    return [
        GSTHsnRuleResponse(
            id=r.id,
            organization_id=str(r.organization_id) if r.organization_id else None,
            hsn_prefix=r.hsn_prefix,
            rule_type=r.rule_type,
        )
        for r in rules
    ]


@router.post("", response_model=GSTHsnRuleResponse, status_code=201)
def create_gst_hsn_rule(
    payload: GSTHsnRuleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new GST HSN rule for the current user's organisation."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None

    rule = GSTHsnRule(
        organization_id=org_id,
        hsn_prefix=payload.hsn_prefix,
        rule_type=payload.rule_type,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return GSTHsnRuleResponse(
        id=rule.id,
        organization_id=str(rule.organization_id) if rule.organization_id else None,
        hsn_prefix=rule.hsn_prefix,
        rule_type=rule.rule_type,
    )


@router.delete("/{rule_id}", status_code=204)
def delete_gst_hsn_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Remove a GST HSN rule."""
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None

    rule = db.query(GSTHsnRule).filter(GSTHsnRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="GST HSN Rule not found")

    # Enforce tenant isolation
    if current_user.role != "Super Admin" and rule.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this rule")

    db.delete(rule)
    db.commit()
