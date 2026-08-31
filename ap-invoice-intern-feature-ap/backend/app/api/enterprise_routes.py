"""REST API endpoints for Advanced Enterprise AP Automation Features."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, validator

from app.core.database import get_db
from app.models.invoice import Invoice
from app.models.tds import TDSSection
from app.models.approval import ApprovalRule

from app.services.tds_engine import TDSEngine
from app.services.gst_compliance import GSTComplianceEngine
from app.services.po_matcher import POMatchingEngine
from app.services.duplicate_detector import DuplicateDetector
from app.services.approval_workflow import ApprovalWorkflowEngine
from app.services.payment_manager import PaymentManager
from app.services.exception_manager import ExceptionManager
from app.services.analytics_dashboard import AnalyticsDashboardService
from app.services.reporting_service import ReportingService
from app.services.ai_assistance import AIAssistanceService

from app.dependencies import get_current_user, require_admin, require_approver, require_reviewer, require_staff, RoleChecker

router = APIRouter(
    prefix="/enterprise",
    tags=["Enterprise AP Automation Features"],
    dependencies=[Depends(get_current_user)]
)

# --- Pydantic Schemas for Requests ---
class TDSConfigCreate(BaseModel):
    section_code: str
    description: Optional[str] = None
    rate_with_pan: float
    rate_without_pan: float
    single_threshold: float
    aggregate_threshold: float

class TDSVerifyRequest(BaseModel):
    invoice_id: int
    section_code: Optional[str] = None
    vendor_pan: Optional[str] = None
    vendor_category: Optional[str] = None
    actual_tds: Optional[float] = None

class GSTVerifyRequest(BaseModel):
    invoice_id: int

class POMatchRequest(BaseModel):
    invoice_id: int
    is_three_way: bool = True

class ApprovalDecisionRequest(BaseModel):
    invoice_id: int
    actor: str
    action: str # APPROVE, REJECT, OVERRIDE
    rejection_reason: Optional[str] = None
    comments: Optional[str] = None

    @validator("rejection_reason")
    def reject_reason_required(cls, v, values):
        if values.get("action") and values["action"].upper() == "REJECT":
            if not v or len(v.strip()) < 3:
                raise ValueError("rejection_reason is mandatory and must be at least 3 characters when rejecting.")
        return v

class ApprovalRuleCreate(BaseModel):
    department: Optional[str] = None
    cost_center: Optional[str] = None
    min_amount: float
    max_amount: Optional[float] = None
    auto_approve: Optional[float] = None
    approvers: List[str]
    sla_hours: int = 48

class PaymentScheduleRequest(BaseModel):
    invoice_id: int
    scheduled_date: date

class RecordPaymentRequest(BaseModel):
    invoice_id: int
    amount_paid: float
    payment_method: str
    reference_number: Optional[str] = None

class CreditDebitNoteRequest(BaseModel):
    invoice_id: int
    note_number: str
    note_type: str # CREDIT, DEBIT
    amount: float
    reason: Optional[str] = None

class ExceptionResolveRequest(BaseModel):
    exception_id: int
    resolved_by: str
    corrections: Optional[Dict[str, Any]] = None

# ==========================================
# 1. TDS ENGINE
# ==========================================
@router.post("/tds/config", response_model=Dict[str, Any], dependencies=[Depends(require_admin)])
def configure_tds_section(config: TDSConfigCreate, db: Session = Depends(get_db)):
    sec = db.query(TDSSection).filter(TDSSection.section_code == config.section_code).first()
    if not sec:
        sec = TDSSection(**config.dict())
        db.add(sec)
    else:
        for k, v in config.dict().items():
            setattr(sec, k, v)

    # Sync to TDSRule table so the calculation engine reads it
    from app.models.tds import TDSRule
    rule = db.query(TDSRule).filter(TDSRule.section_code == config.section_code).first()
    
    # Normalize rates (ensure percent, not decimal fraction)
    rate_p = config.rate_with_pan * 100.0 if config.rate_with_pan < 0.5 else config.rate_with_pan
    rate_w_p = config.rate_without_pan * 100.0 if config.rate_without_pan < 0.5 else config.rate_without_pan

    if not rule:
        rule = TDSRule(
            section_code=config.section_code,
            description=config.description,
            rate_with_pan=rate_p,
            rate_without_pan=rate_w_p,
            single_threshold=config.single_threshold,
            aggregate_threshold=config.aggregate_threshold,
            vendor_categories="[]",
            expense_categories="[]"
        )
        db.add(rule)
    else:
        rule.description = config.description
        rule.rate_with_pan = rate_p
        rule.rate_without_pan = rate_w_p
        rule.single_threshold = config.single_threshold
        rule.aggregate_threshold = config.aggregate_threshold
        db.add(rule)

    db.commit()
    return {"success": True, "message": f"TDS section {config.section_code} configured successfully."}

@router.post("/tds/calculate", response_model=Dict[str, Any])
def run_tds_calculation(req: TDSVerifyRequest, db: Session = Depends(get_db), current_user = Depends(RoleChecker(["Reviewer", "Approver", "Admin"]))): # Shared Stage 1 & 2: TDS calculation verification
    inv = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = TDSEngine()
    res = engine.calculate_tds(
        db=db,
        invoice=inv,
        section_code=req.section_code,
        vendor_pan=req.vendor_pan,
        vendor_category=req.vendor_category,
        actual_tds=req.actual_tds
    )
    return res

# ==========================================
# 2. ADVANCED GST COMPLIANCE
# ==========================================
@router.post("/gst/verify", response_model=Dict[str, Any])
def verify_gst_compliance(req: GSTVerifyRequest, db: Session = Depends(get_db), current_user = Depends(RoleChecker(["Reviewer", "Approver", "Admin"]))): # Shared Stage 1 & 2: GST compliance verification
    from app.models.settings import Settings as SettingsModel
    settings = db.query(SettingsModel).first()
    if settings and not settings.rules_gst_validation:
        return {"passed": True, "message": "GST validation is disabled in system settings.", "errors": []}
    inv = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = GSTComplianceEngine()
    res = engine.verify_gst_compliance(db, inv)
    return res

# ==========================================
# 3. ADVANCED PO MATCHING
# ==========================================
@router.post("/po-match", response_model=Dict[str, Any])
def perform_po_matching(req: POMatchRequest, db: Session = Depends(get_db), current_user = Depends(RoleChecker(["Reviewer", "Approver", "Admin"]))): # Shared Stage 1 & 2: PO matching trigger
    from app.models.settings import Settings as SettingsModel
    settings = db.query(SettingsModel).first()
    if settings and not settings.rules_po_matching:
        return {"match_status": "skipped", "message": "PO matching is disabled in system settings.", "match_score": None}
    inv = db.query(Invoice).filter(Invoice.id == req.invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = POMatchingEngine()
    res = engine.perform_matching(db, inv, req.is_three_way)
    return res

# ==========================================
# 4. DUPLICATE DETECTION
# ==========================================
@router.get("/duplicate-check/{invoice_id}", response_model=Dict[str, Any])
def check_invoice_duplicate(invoice_id: int, db: Session = Depends(get_db)):
    from app.models.settings import Settings as SettingsModel
    settings = db.query(SettingsModel).first()
    if settings and not settings.rules_duplicate_detection:
        return {"duplicate_detected": False, "message": "Duplicate detection is disabled in system settings.", "matches": []}
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    detector = DuplicateDetector()
    res = detector.check_duplicates(db, inv)
    return res

# ==========================================
# 5. APPROVAL WORKFLOW ENGINE
# ==========================================
@router.post("/approvals/rule", response_model=Dict[str, Any], dependencies=[Depends(require_admin)]) # Admin Stage: Workflow rules configuration setup
def create_approval_rule(rule_data: ApprovalRuleCreate, db: Session = Depends(get_db)):
    try:
        db.begin()
        rule = ApprovalRule(**rule_data.dict())
        db.add(rule)
        db.commit()
        return {"success": True, "message": "Approval routing rule registered successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to register rule: {e}")

@router.post("/approvals/decision", response_model=Dict[str, Any]) # Stage 2: Approver Final Decision
def submit_approval_decision(req: ApprovalDecisionRequest, db: Session = Depends(get_db), current_user = Depends(require_approver)):
    engine = ApprovalWorkflowEngine()
    try:
        res = engine.process_decision(
            db=db,
            invoice_id=req.invoice_id,
            actor=current_user.name,
            actor_id=current_user.id,
            action=req.action,
            rejection_reason=req.rejection_reason,
            comments=req.comments
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/approvals/sla-check", response_model=Dict[str, Any])
def check_workflow_slas(db: Session = Depends(get_db)):
    engine = ApprovalWorkflowEngine()
    count = engine.monitor_slas(db)
    return {"escalated_count": count}

# ==========================================
# 6. PAYMENT MANAGEMENT
# ==========================================
@router.post("/payments/schedule", response_model=Dict[str, Any], dependencies=[Depends(require_approver)]) # Stage 2: Approver Final Payment Schedule
def schedule_payout(req: PaymentScheduleRequest, db: Session = Depends(get_db)):
    manager = PaymentManager()
    try:
        res = manager.schedule_payment(db, req.invoice_id, req.scheduled_date)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/payments/record", response_model=Dict[str, Any], dependencies=[Depends(require_approver)]) # Stage 2: Approver Final Payment Recording
def record_payout_transaction(req: RecordPaymentRequest, db: Session = Depends(get_db)):
    manager = PaymentManager()
    try:
        res = manager.record_payment_transaction(db, req.invoice_id, req.amount_paid, req.payment_method, req.reference_number)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/payments/credit-debit-note", response_model=Dict[str, Any], dependencies=[Depends(require_approver)]) # Stage 2: Approver Final Payment Note Posting
def post_credit_debit_note(req: CreditDebitNoteRequest, db: Session = Depends(get_db)):
    manager = PaymentManager()
    try:
        res = manager.apply_credit_debit_note(db, req.invoice_id, req.note_number, req.note_type, req.amount, req.reason)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# 9. EXCEPTION MANAGEMENT
# ==========================================
@router.get("/exceptions/pending", response_model=List[Dict[str, Any]])
def list_pending_exceptions(db: Session = Depends(get_db)):
    manager = ExceptionManager()
    excs = manager.get_pending_exceptions(db)
    return [
        {
            "id": e.id,
            "invoice_id": e.invoice_id,
            "exception_type": e.exception_type,
            "error_message": e.error_message,
            "status": e.status,
            "created_at": e.created_at.isoformat()
        } for e in excs
    ]

@router.post("/exceptions/resolve", response_model=Dict[str, Any], dependencies=[Depends(require_staff)]) # Shared Stage 1 & 2: Staff Exception resolution (Reviewer, Approver, or Admin)
def resolve_invoice_exception(req: ExceptionResolveRequest, db: Session = Depends(get_db)):
    manager = ExceptionManager()
    try:
        res = manager.resolve_exception(db, req.exception_id, req.resolved_by, req.corrections)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# 10. ANALYTICS DASHBOARD
# ==========================================
@router.get("/analytics/dashboard", response_model=Dict[str, Any])
def fetch_analytics_dashboard(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    service = AnalyticsDashboardService()
    return service.get_live_metrics(db, current_user=current_user)

# ==========================================
# 11. REPORTING MODULE
# ==========================================
@router.get("/reports/csv", response_class=Response)
def download_csv_report(report_type: str = Query(..., description="invoices, gst, tds, payments, exceptions, audit"), db: Session = Depends(get_db)):
    service = ReportingService()
    try:
        csv_data = service.generate_csv_report(db, report_type)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_type}_report.csv"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# 12. AI ENHANCEMENTS
# ==========================================
@router.get("/ai-assistance/explain/{invoice_id}", response_model=Dict[str, Any])
def explain_extraction_confidence(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    service = AIAssistanceService()
    return service.explain_confidence(inv)

@router.get("/ai-assistance/suggestions/{invoice_id}", response_model=List[Dict[str, Any]])
def suggest_missing_fields_api(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    service = AIAssistanceService()
    return service.suggest_missing_fields(inv)

@router.get("/ai-assistance/classify/{invoice_id}", response_model=Dict[str, Any])
def classify_invoice_api(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    service = AIAssistanceService()
    return service.classify_invoice(inv)

@router.get("/ai-assistance/summary/{invoice_id}", response_model=Dict[str, str])
def get_ai_summary(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    service = AIAssistanceService()
    summary = service.generate_ai_summary(inv)
    return {"summary": summary}

# ==========================================
# PART 6 — SPECIFIC ENDPOINTS
# ==========================================
@router.get("/compliance/report/{invoice_id}", response_model=Dict[str, Any])
def get_compliance_report(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = GSTComplianceEngine()
    tds_engine = TDSEngine()
    
    gst_rep = engine.verify_gst_compliance(db, inv)
    tds_rep = tds_engine.calculate_tds(db, inv)
    
    return {
        "invoice_id": invoice_id,
        "gst_compliance": gst_rep,
        "tds_compliance": tds_rep,
        "overall_status": "PASS" if (gst_rep["is_compliant"] and tds_rep["status"] == "PASS") else "FAILED"
    }

@router.get("/compliance/tds/{invoice_id}", response_model=Dict[str, Any])
def get_tds_validation(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = TDSEngine()
    return engine.calculate_tds(db, inv)

@router.get("/compliance/gst/{invoice_id}", response_model=Dict[str, Any])
def get_gst_reconciliation(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = GSTComplianceEngine()
    return engine.verify_gst_reconciliation(db, inv)

@router.get("/compliance/rcm/{invoice_id}", response_model=Dict[str, Any])
def get_rcm_validation(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = GSTComplianceEngine()
    return engine.verify_rcm(inv)

@router.get("/compliance/hsn/{invoice_id}", response_model=Dict[str, Any])
def get_hsn_validation(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = GSTComplianceEngine()
    return engine.verify_hsn_sac(db, inv)

@router.get("/compliance/irn/{invoice_id}", response_model=Dict[str, Any])
def get_irn_validation(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    engine = GSTComplianceEngine()
    return engine.verify_irn(db, inv)

@router.get("/workflow/status/{invoice_id}", response_model=Dict[str, Any])
def get_workflow_status(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    from app.workflow.service import WorkflowService
    from app.services.sla_engine import SLAEngine
    ws = WorkflowService()
    history = ws.get_history(db, invoice_id)
    
    sla_stats = SLAEngine.get_invoice_sla(db, inv)
    
    return {
        "invoice_id": invoice_id,
        "status": inv.status,
        "workflow_status": inv.workflow_status,
        "history": history,
        "sla": sla_stats
    }

@router.post("/workflow/action", response_model=Dict[str, Any]) # Stage 2: Approver Final Decision (FSM workflow action)
def submit_workflow_action(req: ApprovalDecisionRequest, db: Session = Depends(get_db), current_user = Depends(require_approver)):
    engine = ApprovalWorkflowEngine()
    try:
        return engine.process_decision(
            db=db,
            invoice_id=req.invoice_id,
            actor=current_user.name,
            actor_id=current_user.id,
            action=req.action,
            rejection_reason=req.rejection_reason,
            comments=req.comments
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/analytics/sla", response_model=Dict[str, Any])
def get_sla_metrics(db: Session = Depends(get_db)):
    service = AnalyticsDashboardService()
    metrics = service.get_live_metrics(db)
    return metrics["processing_sla"]

@router.get("/analytics/vendors", response_model=List[Dict[str, Any]])
def get_vendor_analytics(db: Session = Depends(get_db)):
    service = AnalyticsDashboardService()
    metrics = service.get_live_metrics(db)
    return metrics["vendor_performance"]

@router.get("/analytics/aging", response_model=Dict[str, Any])
def get_invoice_aging(db: Session = Depends(get_db)):
    service = AnalyticsDashboardService()
    metrics = service.get_live_metrics(db)
    return metrics["invoice_aging"]

@router.get("/analytics/queue", response_model=Dict[str, Any])
def get_queue_health(db: Session = Depends(get_db)):
    service = AnalyticsDashboardService()
    metrics = service.get_live_metrics(db)
    return metrics["queue_health"]
