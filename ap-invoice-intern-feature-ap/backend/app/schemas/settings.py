from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, Optional, List


class SettingsBase(BaseModel):
    company_name: str
    timezone: str
    currency: str
    financial_year: str
    language: str

    ai_model: str
    ai_temperature: float
    ai_confidence_threshold: float
    ai_extraction_version: str
    ai_prompt_version: str
    ai_prompt_notes: Optional[str] = None

    workflow_reviewer_required: bool
    workflow_approver_required: bool
    workflow_auto_reviewer: bool
    workflow_auto_approver: bool
    workflow_approval_levels: int
    workflow_manual_override: bool

    rules_required_fields: Dict[str, bool]
    rules_duplicate_detection: bool
    rules_gst_validation: bool
    rules_po_matching: bool
    rules_amount_tolerance: float

    # GST compliance parameters (DB-backed, exposed via /settings/gst-config)
    gst_tolerance_amount: float = 1.0
    gst_reconciliation_threshold_pct: float = 98.0
    gst_max_past_days: int = 30
    gst_prevent_duplicate_irn: bool = True
    gst_check_date_consistency: bool = True

    sla_review: int
    sla_approval: int
    sla_processing: int
    sla_reminder_time: int
    sla_escalation_time: int
    sla_critical_threshold: int

    escalation_role: str = "Admin"
    sla_grace_period_hours: int = 2

    # PO match tolerances and thresholds
    po_qty_tolerance_pct: float = 5.0
    po_price_tolerance_pct: float = 2.0
    po_tax_tolerance_pct: float = 0.0
    po_freight_tolerance_amount: float = 50.0
    po_vendor_name_threshold_pct: float = 85.0
    po_min_match_score: float = 80.0

    # Reviewer Validation Workbench Configs
    reviewer_mandatory_review_rules: Dict[str, Any] = {
        "force_on_all": False,
        "fields_required": ["invoice_number", "invoice_date", "total_invoice_value"]
    }
    reviewer_auto_routing: bool = True
    reviewer_checklist_items: List[str] = [
        "Verified vendor name and GSTIN matches OCR",
        "Confirmed line items and tax amounts are correct",
        "Checked PO number correspondence"
    ]
    reviewer_comment_requirements: Dict[str, bool] = {
        "force_on_edits": True,
        "force_on_rejection": True
    }
    reviewer_return_to_vendor_enabled: bool = True
    reviewer_edit_permissions: Dict[str, bool] = {
        "Reviewer": True,
        "Admin": True
    }


class SettingsCreate(SettingsBase):
    pass


class GSTConfigUpdate(BaseModel):
    """Partial update payload for GST compliance parameters only."""
    gst_tolerance_amount: Optional[float] = None
    gst_reconciliation_threshold_pct: Optional[float] = None
    gst_max_past_days: Optional[int] = None
    gst_prevent_duplicate_irn: Optional[bool] = None
    gst_check_date_consistency: Optional[bool] = None


class GSTConfigResponse(BaseModel):
    gst_tolerance_amount: float
    gst_reconciliation_threshold_pct: float
    gst_max_past_days: int
    gst_prevent_duplicate_irn: bool
    gst_check_date_consistency: bool

    model_config = ConfigDict(from_attributes=True)


class POMatchConfigUpdate(BaseModel):
    """Partial update payload for PO Match tolerance parameters only."""
    po_qty_tolerance_pct: Optional[float] = None
    po_price_tolerance_pct: Optional[float] = None
    po_tax_tolerance_pct: Optional[float] = None
    po_freight_tolerance_amount: Optional[float] = None
    po_vendor_name_threshold_pct: Optional[float] = None
    po_min_match_score: Optional[float] = None


class POMatchConfigResponse(BaseModel):
    po_qty_tolerance_pct: float
    po_price_tolerance_pct: float
    po_tax_tolerance_pct: float
    po_freight_tolerance_amount: float
    po_vendor_name_threshold_pct: float
    po_min_match_score: float

    model_config = ConfigDict(from_attributes=True)



class SettingsResponse(SettingsBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ApprovalRuleBase(BaseModel):
    department: Optional[str] = None
    cost_center: Optional[str] = None
    min_amount: float
    max_amount: Optional[float] = None
    auto_approve: Optional[float] = None
    approvers: List[str]
    sla_hours: int = 48


class ApprovalRuleCreate(ApprovalRuleBase):
    pass


class ApprovalRuleUpdate(BaseModel):
    department: Optional[str] = None
    cost_center: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    auto_approve: Optional[float] = None
    approvers: Optional[List[str]] = None
    sla_hours: Optional[int] = None


class ApprovalRuleResponse(ApprovalRuleBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
