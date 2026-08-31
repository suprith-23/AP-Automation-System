"""Configurable Approval Workflow Engine."""
import logging
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.models.approval import ApprovalRule, ApprovalRequest, ApprovalHistory

logger = logging.getLogger("approval.workflow")

class ApprovalWorkflowEngine:
    def init_approval_workflow(
        self,
        db: Session,
        invoice: Invoice,
        department: Optional[str] = None,
        cost_center: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Initializes the approval routing sequence for an invoice based on database rules or approval_matrix.json fallback.
        """
        amount = invoice.total_invoice_value or invoice.total_amount or 0.0
        confidence = invoice.confidence_score or 1.0

        # Try database rules first
        query = db.query(ApprovalRule).filter(ApprovalRule.min_amount <= amount)
        if department:
            query = query.filter(ApprovalRule.department == department)
        if cost_center:
            query = query.filter(ApprovalRule.cost_center == cost_center)
        rule = query.order_by(ApprovalRule.min_amount.desc()).first()

        if not rule:
            rule = db.query(ApprovalRule).filter(
                ApprovalRule.min_amount <= amount,
                ApprovalRule.department == None,
                ApprovalRule.cost_center == None
            ).order_by(ApprovalRule.min_amount.desc()).first()

        if rule:
            approver_roles = rule.approvers or ["Manager"]
            sla_hours = rule.sla_hours or 24
            auto_approve = False
            if rule.auto_approve is not None and amount <= rule.auto_approve:
                auto_approve = True
        else:
            # Fallback to JSON matrix
            from app.core.config import CONFIG
            matrix_rules = CONFIG.approval_matrix.get("rules", [])
            matched_rule = None
            for r in matrix_rules:
                min_amt = r.get("min_amount", 0.0)
                max_amt = r.get("max_amount")
                if amount < min_amt:
                    continue
                if max_amt is not None and amount > max_amt:
                    continue
                rule_dept = r.get("department")
                if rule_dept and department and rule_dept.lower() != department.lower():
                    continue
                min_conf = r.get("min_confidence", 0.0)
                if confidence < min_conf:
                    continue
                matched_rule = r
                break
            
            if not matched_rule:
                matched_rule = {
                    "auto_approve": False,
                    "approvers": ["Manager"],
                    "sla_hours": 24
                }
            
            approver_roles = matched_rule.get("approvers", ["Manager"])
            sla_hours = matched_rule.get("sla_hours", 24)
            auto_approve = matched_rule.get("auto_approve", False)

        # Check Auto-Approval
        if auto_approve:
            invoice.status = "APPROVED"
            invoice.workflow_status = InvoiceWorkflowStatus.approved
            db.commit()

            # Record history
            hist = ApprovalHistory(
                invoice_id=invoice.id,
                level=0,
                actor="system",
                actor_id=None,
                action="AUTO_APPROVE",
                role="system",
                previous_status="validation_pending",
                current_status="APPROVED",
                comments=f"Auto-approved: invoice amount '{amount}' matched auto-approval rule."
            )
            db.add(hist)
            db.commit()

            return {
                "status": "APPROVED",
                "message": "Invoice auto-approved successfully.",
                "request_id": None
            }

        # Clear any existing approval requests for this invoice
        db.query(ApprovalRequest).filter(ApprovalRequest.invoice_id == invoice.id).delete()

        deadline = datetime.utcnow() + timedelta(hours=sla_hours)
        req = ApprovalRequest(
            invoice_id=invoice.id,
            current_level=1,
            status="PENDING",
            assigned_role=approver_roles[0],
            sla_deadline=deadline
        )
        db.add(req)
        
        invoice.status = "PENDING_APPROVAL"
        invoice.workflow_status = InvoiceWorkflowStatus.pending_approval
        db.commit()
        db.refresh(req)

        return {
            "status": "PENDING_APPROVAL",
            "message": f"Approval routing started. Assigned to role: {approver_roles[0]} (SLA: {sla_hours}h).",
            "request_id": req.id
        }

    def process_decision(
        self,
        db: Session,
        invoice_id: int,
        actor: str,
        actor_id: Optional[UUID],
        action: str, # APPROVE, REJECT, OVERRIDE
        rejection_reason: Optional[str] = None,
        comments: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process an approval, rejection, or administrative manual override.
        """
        req = db.query(ApprovalRequest).filter(
            ApprovalRequest.invoice_id == invoice_id,
            ApprovalRequest.status.in_(["PENDING", "ESCALATED"])
        ).first()

        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError("Invoice not found.")

        # If override is requested
        if action.upper() == "OVERRIDE":
            if req:
                req.status = "APPROVED"
            prev_status = invoice.status
            invoice.status = "APPROVED"
            invoice.workflow_status = InvoiceWorkflowStatus.approved
            
            hist = ApprovalHistory(
                invoice_id=invoice_id,
                level=req.current_level if req else 0,
                actor=actor,
                actor_id=actor_id,
                action="OVERRIDE",
                role="Admin",
                previous_status=prev_status,
                current_status="APPROVED",
                comments=comments or "Administrative manual override."
            )
            db.add(hist)
            db.commit()
            return {"status": "APPROVED", "message": "Manual override applied successfully."}

        if not req:
            raise ValueError("No active approval request found for this invoice.")

        amount = invoice.total_invoice_value or invoice.total_amount or 0.0
        confidence = invoice.confidence_score or 1.0

        # Try database rules first to get approver roles
        query = db.query(ApprovalRule).filter(ApprovalRule.min_amount <= amount)
        # Try to find rule by invoice's matching flow or department (if we had it, but here query from DB)
        rule = query.order_by(ApprovalRule.min_amount.desc()).first()

        if rule:
            approver_roles = rule.approvers or ["Manager"]
            sla_hours = rule.sla_hours or 24
        else:
            # Fallback to JSON matrix
            from app.core.config import CONFIG
            matrix_rules = CONFIG.approval_matrix.get("rules", [])
            matched_rule = None
            for r in matrix_rules:
                min_amt = r.get("min_amount", 0.0)
                max_amt = r.get("max_amount")
                if amount < min_amt:
                    continue
                if max_amt is not None and amount > max_amt:
                    continue
                matched_rule = r
                break
            
            approver_roles = matched_rule.get("approvers", ["Manager"]) if matched_rule else ["Manager"]
            sla_hours = matched_rule.get("sla_hours", 24) if matched_rule else 24

        def get_decision_details():
            original_values = invoice.extracted_json or {}
            corrected_values = {}
            fields_to_track = ["invoice_number", "invoice_date", "total_invoice_value", "seller_gstin", "po_number"]
            for f in fields_to_track:
                orig_val = original_values.get(f)
                curr_val = getattr(invoice, f, None)
                if isinstance(curr_val, (date, datetime)):
                    curr_val_str = curr_val.strftime("%Y-%m-%d")
                else:
                    curr_val_str = str(curr_val) if curr_val is not None else None
                orig_val_str = str(orig_val) if orig_val is not None else None
                if curr_val_str != orig_val_str:
                    corrected_values[f] = {
                        "original": orig_val,
                        "corrected": curr_val_str
                    }
            return {
                "decision": action.upper(),
                "comment": comments or rejection_reason or "",
                "original_ai_extracted": original_values,
                "human_corrected_values": corrected_values
            }

        if action.upper() == "REJECT":
            prev_status = invoice.status
            req.status = "REJECTED"
            invoice.status = "PENDING_REVIEW"
            invoice.workflow_status = InvoiceWorkflowStatus.pending_review

            hist = ApprovalHistory(
                invoice_id=invoice_id,
                level=req.current_level,
                actor=actor,
                actor_id=actor_id,
                action="REJECT",
                role=req.assigned_role,
                previous_status=prev_status,
                current_status="PENDING_REVIEW",
                rejection_reason=rejection_reason,
                comments=comments
            )
            db.add(hist)
            db.commit()
            
            from app.services.audit_log_service import AuditService
            AuditService.log(
                db=db,
                action="INVOICE_REJECTED",
                invoice_id=invoice.id,
                status_before=prev_status,
                status_after="pending_review",
                performed_by=actor,
                details=get_decision_details()
            )
            return {"status": "PENDING_REVIEW", "message": "Invoice rejected and returned to reviewer queue."}

        elif action.upper() == "APPROVE":
            prev_status = invoice.status
            # Move to next level
            next_level = req.current_level + 1
            if next_level <= len(approver_roles):
                old_role = req.assigned_role
                req.current_level = next_level
                req.assigned_role = approver_roles[next_level - 1]
                req.sla_deadline = datetime.utcnow() + timedelta(hours=sla_hours)
                req.status = "PENDING"
                
                # Record approval in history
                hist = ApprovalHistory(
                    invoice_id=invoice_id,
                    level=req.current_level - 1,
                    actor=actor,
                    actor_id=actor_id,
                    action="APPROVE",
                    role=old_role,
                    previous_status=prev_status,
                    current_status="PENDING_APPROVAL",
                    comments=comments
                )
                db.add(hist)
                db.commit()
                
                from app.services.audit_log_service import AuditService
                AuditService.log(
                    db=db,
                    action="INVOICE_APPROVED_LEVEL",
                    invoice_id=invoice.id,
                    status_before=prev_status,
                    status_after="pending_approval",
                    performed_by=actor,
                    details=get_decision_details()
                )
                return {
                    "status": "PENDING_APPROVAL",
                    "message": f"Approved level {req.current_level-1}. Assigned to next role: {req.assigned_role}."
                }
            else:
                # Fully approved
                req.status = "APPROVED"
                invoice.status = "APPROVED"
                invoice.workflow_status = InvoiceWorkflowStatus.approved
                
                hist = ApprovalHistory(
                    invoice_id=invoice_id,
                    level=req.current_level,
                    actor=actor,
                    actor_id=actor_id,
                    action="APPROVE",
                    role=req.assigned_role,
                    previous_status=prev_status,
                    current_status="APPROVED",
                    comments=comments
                )
                db.add(hist)
                db.commit()
                
                from app.services.audit_log_service import AuditService
                AuditService.log(
                    db=db,
                    action="INVOICE_FULLY_APPROVED",
                    invoice_id=invoice.id,
                    status_before=prev_status,
                    status_after="approved",
                    performed_by=actor,
                    details=get_decision_details()
                )
                return {
                    "status": "APPROVED",
                    "message": "Invoice fully approved."
                }

        raise ValueError(f"Invalid approval action: {action}")

    def monitor_slas(self, db: Session) -> int:
        """
        Identify approval requests that exceeded the SLA deadlines and escalate them.
        """
        from app.models.settings import Settings
        settings = db.query(Settings).first()
        escalation_role = settings.escalation_role if settings else "Admin"
        
        now = datetime.utcnow()
        overdue_requests = db.query(ApprovalRequest).filter(
            ApprovalRequest.status == "PENDING",
            ApprovalRequest.sla_deadline < now
        ).all()

        count = 0
        for req in overdue_requests:
            req.status = "ESCALATED"
            
            old_role = req.assigned_role
            req.assigned_role = escalation_role
            
            hist = ApprovalHistory(
                invoice_id=req.invoice_id,
                level=req.current_level,
                actor="system",
                actor_id=None,
                action="ESCALATE",
                role="system",
                previous_status=req.invoice.status if req.invoice else "PENDING_APPROVAL",
                current_status="PENDING_APPROVAL",
                comments=f"SLA breached. Escalated from role '{old_role}' to role: {escalation_role}."
            )
            db.add(hist)
            
            # Increment SLA breach metric
            from app.core.metrics import WORKFLOW_SLA_BREACH
            org_id_str = str(req.invoice.organization_id) if (req.invoice and req.invoice.organization_id) else "global"
            WORKFLOW_SLA_BREACH.labels(role=old_role, tenant_id=org_id_str).inc()
            
            count += 1

        if count > 0:
            db.commit()
        return count
