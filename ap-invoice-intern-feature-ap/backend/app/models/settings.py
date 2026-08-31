from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    company_name = Column(String, default="Acme Corp", nullable=False)
    timezone = Column(String, default="IST (UTC+05:30)", nullable=False)
    currency = Column(String, default="INR (₹)", nullable=False)
    financial_year = Column(String, default="FY2026-27", nullable=False)
    language = Column(String, default="English", nullable=False)

    ai_model = Column(String, default="Groq-Llama-3-70b", nullable=False)
    ai_temperature = Column(Float, default=0.1, nullable=False)
    ai_confidence_threshold = Column(Float, default=0.85, nullable=False)
    ai_extraction_version = Column(String, default="v2.4.1", nullable=False)
    ai_prompt_version = Column(String, default="v3.8", nullable=False)
    ai_prompt_notes = Column(String, default="Optimized extraction for GST compliant tax invoices", nullable=True)

    workflow_reviewer_required = Column(Boolean, default=True, nullable=False)
    workflow_approver_required = Column(Boolean, default=True, nullable=False)
    workflow_auto_reviewer = Column(Boolean, default=False, nullable=False)
    workflow_auto_approver = Column(Boolean, default=False, nullable=False)
    workflow_approval_levels = Column(Integer, default=2, nullable=False)
    workflow_manual_override = Column(Boolean, default=False, nullable=False)

    rules_required_fields = Column(JSON, default=lambda: {
        "invoice_number": True,
        "invoice_date": True,
        "seller_gstin": True,
        "buyer_gstin": True,
        "total_amount": True,
    }, nullable=False)
    rules_duplicate_detection = Column(Boolean, default=True, nullable=False)
    rules_gst_validation = Column(Boolean, default=True, nullable=False)
    rules_po_matching = Column(Boolean, default=True, nullable=False)
    rules_amount_tolerance = Column(Float, default=1.5, nullable=False)

    # GST compliance parameters — previously static JSON, now DB-backed.
    # Defaults match gst_rules.json + irn_rules.json so behaviour is identical
    # until an admin changes them via the Validation Rules tab.
    gst_tolerance_amount = Column(Float, default=1.0, nullable=False)
    gst_reconciliation_threshold_pct = Column(Float, default=98.0, nullable=False)
    gst_max_past_days = Column(Integer, default=30, nullable=False)
    gst_prevent_duplicate_irn = Column(Boolean, default=True, nullable=False)
    gst_check_date_consistency = Column(Boolean, default=True, nullable=False)

    sla_review = Column(Integer, default=4, nullable=False)
    sla_approval = Column(Integer, default=12, nullable=False)
    sla_processing = Column(Integer, default=24, nullable=False)
    sla_reminder_time = Column(Integer, default=1, nullable=False)
    sla_escalation_time = Column(Integer, default=2, nullable=False)
    sla_critical_threshold = Column(Integer, default=80, nullable=False)

    escalation_role = Column(String, default="Admin", nullable=False)
    sla_grace_period_hours = Column(Integer, default=2, nullable=False)

    # --- Webhooks (System Integration) ---
    webhook_enabled = Column(Boolean, default=False, nullable=False)
    webhook_url = Column(String, nullable=True)
    webhook_secret = Column(String, nullable=True)
    webhook_events = Column(JSON, default=lambda: ["INVOICE_RECEIVED", "VALIDATION_FAILED", "INVOICE_MATCHED", "INVOICE_APPROVED", "INVOICE_REJECTED", "PAYMENT_READY", "IRN_VERIFIED", "IRN_REJECTED"], nullable=False)
    webhook_provider = Column(String, default="INTERNAL_SANDBOX", nullable=False)

    # --- Notifications (Human Alerts) ---
    discord_webhook_url = Column(String, nullable=True)
    notification_events = Column(JSON, default=lambda: ["INVOICE_REJECTED", "VALIDATION_FAILED", "SLA_BREACHED"], nullable=False)

    # PO match tolerances and thresholds
    po_qty_tolerance_pct = Column(Float, default=5.0, nullable=False)
    po_price_tolerance_pct = Column(Float, default=2.0, nullable=False)
    po_tax_tolerance_pct = Column(Float, default=0.0, nullable=False)
    po_freight_tolerance_amount = Column(Float, default=50.0, nullable=False)
    po_vendor_name_threshold_pct = Column(Float, default=85.0, nullable=False)
    po_min_match_score = Column(Float, default=80.0, nullable=False)

    # Reviewer Validation Workbench Configs
    reviewer_mandatory_review_rules = Column(JSON, default=lambda: {
        "force_on_all": False,
        "fields_required": ["invoice_number", "invoice_date", "total_invoice_value"]
    }, nullable=False)
    reviewer_auto_routing = Column(Boolean, default=True, nullable=False)
    reviewer_checklist_items = Column(JSON, default=lambda: [
        "Verified vendor name and GSTIN matches OCR",
        "Confirmed line items and tax amounts are correct",
        "Checked PO number correspondence"
    ], nullable=False)
    reviewer_comment_requirements = Column(JSON, default=lambda: {
        "force_on_edits": True,
        "force_on_rejection": True
    }, nullable=False)
    reviewer_return_to_vendor_enabled = Column(Boolean, default=True, nullable=False)
    reviewer_edit_permissions = Column(JSON, default=lambda: {
        "Reviewer": True,
        "Admin": True
    }, nullable=False)

    @classmethod
    def get_for_organization(cls, db, organization_id):
        """Fetch settings for organization_id, falling back to global settings if not found."""
        # Clean organization_id just in case it is passed as a string representation of uuid
        import uuid
        org_uuid = organization_id
        if isinstance(organization_id, str):
            try:
                org_uuid = uuid.UUID(organization_id)
            except ValueError:
                org_uuid = None

        settings = db.query(cls).filter(cls.organization_id == org_uuid).first()
        if not settings and org_uuid is not None:
            # Fallback to global template
            settings = db.query(cls).filter(cls.organization_id == None).first()
        if not settings:
            # Create a default settings row
            settings = cls(
                organization_id=org_uuid,
                company_name="Acme Corp",
                timezone="IST (UTC+05:30)",
                currency="INR (₹)",
                financial_year="FY2026-27",
                language="English"
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        return settings

