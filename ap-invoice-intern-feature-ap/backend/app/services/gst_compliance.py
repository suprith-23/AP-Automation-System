"""GST Compliance and Verification Engine."""
import os
import re
import logging
import json
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.hsn_master import HSNMaster
from app.models.purchase_order import PurchaseOrder

logger = logging.getLogger("gst.compliance")

class GSTComplianceEngine:
    def __init__(self):
        from app.core.config import CONFIG
        self.config = CONFIG.compliance_rules
        self.state_codes = CONFIG.state_codes
        
        # Load from new configuration JSON files
        self.gst_rules = CONFIG.gst_rules
        self.rcm_rules_config = CONFIG.rcm_rules.get("rules", [])
        self.irn_rules = CONFIG.irn_rules
        
        # Legacy fallbacks
        self.rcm_hsn_codes = set(self.config.get("hsn_sac", {}).get("rcm_hsn_codes", []))
        self.blocked_itc_hsn_codes = set(self.config.get("hsn_sac", {}).get("blocked_itc_hsn_codes", []))

    @staticmethod
    def validate_gstin(gstin: Optional[str]) -> bool:
        """
        Validate Indian GSTIN format.
        """
        if not gstin:
            return False
        gstin = gstin.strip().upper()
        if len(gstin) != 15:
            return False
        pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
        return bool(re.match(pattern, gstin))

    def verify_rcm(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Runs RCM rules against invoice details.
        """
        seller_gst = invoice.seller_gstin.strip().upper() if invoice.seller_gstin else ""
        vendor_category = ""
        expense_category = ""
        if invoice.extracted_json:
            vendor_category = invoice.extracted_json.get("vendor_category") or ""
            expense_category = invoice.extracted_json.get("expense_category") or ""
        
        invoice_type = invoice.type_of_invoice or "TAX_INVOICE"
        gst_category = "Registered" if seller_gst else "Unregistered"

        rcm_applicable = False
        reason = "RCM not applicable."
        matched_rule = "None"
        section = "N/A"
        recommendation = "Pay forward charge invoice as usual."

        # 1. Match configured rules from rcm_rules.json
        for rule in self.rcm_rules_config:
            # Check vendor category
            match_vendor = False
            rule_v_cat = rule.get("vendor_category")
            if rule_v_cat:
                if rule_v_cat.lower() == vendor_category.lower():
                    match_vendor = True
                elif rule_v_cat == "Unregistered" and not seller_gst:
                    match_vendor = True
            else:
                match_vendor = True

            # Check GST status
            match_gst = False
            rule_gst = rule.get("supplier_gst_status")
            if rule_gst:
                if rule_gst.lower() == gst_category.lower():
                    match_gst = True
            else:
                match_gst = True

            # Check invoice type
            match_type = False
            rule_inv_type = rule.get("invoice_type")
            if rule_inv_type:
                if rule_inv_type.lower() == invoice_type.lower():
                    match_type = True
            else:
                match_type = True

            if match_vendor and match_gst and match_type:
                rcm_applicable = rule.get("rcm_applicable", False)
                reason = rule.get("reason", "")
                matched_rule = rule.get("rule_id", "RCM_MATCHED")
                section = rule.get("section", "N/A")
                recommendation = rule.get("recommendation", "")
                break

        # 2. Check HSN code prefixes
        for item in invoice.items:
            hsn = item.hsn_code.strip() if item.hsn_code else ""
            if hsn and any(hsn.startswith(rc_prefix) for rc_prefix in self.rcm_hsn_codes):
                rcm_applicable = True
                matched_rule = "HSN_COMPULSORY_RCM"
                section = "Section 9(3) of CGST Act"
                reason = f"HSN code '{hsn}' triggers compulsory reverse charge."
                recommendation = "Accrue CGST and SGST/IGST under RCM."
                break

        return {
            "rcm_applicable": rcm_applicable,
            "matched_rule": matched_rule,
            "reason": reason,
            "legal_reason": reason,
            "status": "Applicable" if rcm_applicable else "Not Applicable",
            "applicable_section": section,
            "recommendation": recommendation
        }

    def verify_irn(self, db: Session, invoice: Invoice) -> Dict[str, Any]:
        """
        Validates the Invoice Reference Number (IRN).

        Two-stage process:
        1. Local checks: format, length, duplicate detection, date consistency.
        2. NIC/GSP API call: verifies the IRN is registered on the government
           e-Invoice portal. Sandbox vs production is determined by the
           E_INVOICE_ENV environment variable ('sandbox' | 'production').
           If credentials are absent, the API stage is skipped with a WARNING
           and the status reflects local-checks only.
        """
        irn_status = "PASS"
        errors = []

        irn_len = self.irn_rules.get("irn_length", 64)
        irn_pattern = self.irn_rules.get("irn_format_pattern", "^[0-9a-fA-F]{64}$")

        # Read editable params from DB (with JSON fallback if settings row missing)
        from app.models.settings import Settings as DBSettings
        cfg = db.query(DBSettings).first()
        prevent_dups = cfg.gst_prevent_duplicate_irn if cfg else self.irn_rules.get("prevent_duplicates", True)
        check_date = cfg.gst_check_date_consistency if cfg else self.irn_rules.get("check_date_consistency", True)
        max_past = cfg.gst_max_past_days if cfg else self.irn_rules.get("max_past_days", 30)

        if not invoice.irn:
            return {
                "status": "NOT_AVAILABLE",
                "errors": [],
                "nic_api_status": "NOT_TRIGGERED",
            }

        # --- Stage 1: Local checks ---
        if len(invoice.irn) != irn_len or not re.match(irn_pattern, invoice.irn):
            irn_status = "FAILED"
            errors.append(f"IRN '{invoice.irn}' format/length is invalid. Expected {irn_len} hex characters.")

        if prevent_dups:
            dup = db.query(Invoice).filter(Invoice.irn == invoice.irn, Invoice.id != invoice.id).first()
            if dup:
                irn_status = "FAILED"
                errors.append(f"Duplicate IRN detected. Already exists on invoice ID: {dup.id}")

        if check_date and invoice.invoice_date:
            today = date.today()
            diff_days = (today - invoice.invoice_date).days
            if diff_days > max_past:
                if irn_status != "FAILED":
                    irn_status = "WARNING"
                errors.append(f"Invoice date {invoice.invoice_date} is older than {max_past} days (diff: {diff_days} days).")

        if irn_status == "FAILED":
            # Persist failure if not previously verified
            if invoice.irn_verification_status != "VERIFIED":
                self._persist_irn_state(db, invoice, "FAILED", "; ".join(errors))
            return {
                "status": irn_status,
                "errors": errors,
                "nic_api_status": "SKIPPED_LOCAL_FAIL",
            }

        # --- Stage 2: NIC/GSP API verification ---
        nic_result = self._call_nic_irn_api(invoice.irn)
        
        # Determine strict DB status mapping
        persist_status = "PENDING"
        message = ""
        
        if nic_result["success"] is False and nic_result.get("api_called"):
            irn_status = "FAILED"
            persist_status = "REJECTED"
            message = f"NIC portal rejected IRN: {nic_result.get('detail', 'Unknown reason')}"
            errors.append(message)
        elif nic_result.get("api_called") is False or nic_result.get("success") is None:
            irn_status = "MANUAL_REVIEW"
            persist_status = "MANUAL_REVIEW"
            message = f"NIC verification skipped or failed: {nic_result.get('detail', 'Network error')}"
            errors.append(message)
        elif nic_result.get("api_called") and nic_result["success"]:
            irn_status = "PASS"
            persist_status = "VERIFIED"
            message = "IRN verified successfully on NIC portal."
            logger.info(f"IRN {invoice.irn[:12]}... verified on NIC portal (env={nic_result.get('env')}).")

        # Idempotency / State persistence
        # Don't overwrite a successful VERIFIED state with a transient MANUAL_REVIEW
        if invoice.irn_verification_status == "VERIFIED" and persist_status == "MANUAL_REVIEW":
            pass # Keep VERIFIED
        else:
            self._persist_irn_state(db, invoice, persist_status, message)

        return {
            "status": irn_status,
            "errors": errors,
            "nic_api_status": nic_result.get("api_status", "UNAVAILABLE"),
            "nic_env": nic_result.get("env"),
        }

    def _persist_irn_state(self, db: Session, invoice: Invoice, status: str, message: str) -> None:
        from app.services.audit_log_service import AuditService
        
        old_status = invoice.irn_verification_status
        if old_status == status and invoice.irn_verification_message == message:
            return # No change
            
        invoice.irn_verification_status = status
        invoice.irn_verification_message = message
        invoice.irn_verified_at = datetime.utcnow()
        db.add(invoice)
        db.commit()
        
        # Trigger Audit
        AuditService.log(
            db=db,
            invoice_id=invoice.id,
            action=f"IRN_VERIFICATION_{status}",
            performed_by="GSTComplianceEngine",
            organization_id=invoice.organization_id,
            status_before=old_status or "PENDING",
            status_after=status,
            details={"message": message, "irn": invoice.irn}
        )

    def _call_nic_irn_api(self, irn: str) -> Dict[str, Any]:
        """
        Call NIC / GSP e-Invoice API to verify that an IRN is registered.

        Environment variables consumed (NEVER hardcoded):
          E_INVOICE_ENV              - 'sandbox' (default) or 'production'
          E_INVOICE_GSP_CLIENT_ID    - GSP client ID
          E_INVOICE_GSP_CLIENT_SECRET- GSP client secret
          E_INVOICE_SANDBOX_URL      - override sandbox base URL (optional)
          E_INVOICE_PROD_URL         - override production base URL (optional)

        Returns a dict:
          {
            "api_called": bool,
            "success": bool | None,
            "env": str,
            "api_status": str,
            "detail": str,
          }
        """
        env = os.getenv("E_INVOICE_ENV", "sandbox").lower()
        client_id = os.getenv("E_INVOICE_GSP_CLIENT_ID", "")
        client_secret = os.getenv("E_INVOICE_GSP_CLIENT_SECRET", "")

        if not client_id or not client_secret:
            logger.warning(
                "E_INVOICE_GSP_CLIENT_ID / E_INVOICE_GSP_CLIENT_SECRET not set. "
                "Skipping NIC IRN API verification. Set these env vars for production use."
            )
            return {
                "api_called": False,
                "success": None,
                "env": env,
                "api_status": "CREDENTIALS_MISSING",
                "detail": "GSP credentials not configured.",
            }

        if env == "production":
            base_url = os.getenv(
                "E_INVOICE_PROD_URL",
                "https://api.einvoice1.gst.gov.in/eicore/v1"
            )
        else:
            base_url = os.getenv(
                "E_INVOICE_SANDBOX_URL",
                "https://einv-apisandbox.nic.in/eicore/v1"
            )

        try:
            import httpx
            url = f"{base_url}/Invoice/IRNDetails/{irn}"
            headers = {
                "client-id": client_id,
                "client-secret": client_secret,
                "user_name": os.getenv("E_INVOICE_GSP_USERNAME", ""),
                "Content-Type": "application/json",
            }
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                # NIC API returns Status=1 for success
                if data.get("Status") == 1:
                    return {
                        "api_called": True,
                        "success": True,
                        "env": env,
                        "api_status": "VERIFIED",
                        "detail": "IRN verified on NIC portal.",
                    }
                else:
                    return {
                        "api_called": True,
                        "success": False,
                        "env": env,
                        "api_status": "REJECTED",
                        "detail": str(data.get("ErrorDetails", data)),
                    }
            elif resp.status_code == 404:
                return {
                    "api_called": True,
                    "success": False,
                    "env": env,
                    "api_status": "NOT_FOUND",
                    "detail": f"IRN not found on NIC portal (HTTP 404).",
                }
            else:
                logger.warning(f"NIC IRN API returned HTTP {resp.status_code}: {resp.text[:200]}")
                return {
                    "api_called": True,
                    "success": None,
                    "env": env,
                    "api_status": f"HTTP_{resp.status_code}",
                    "detail": resp.text[:200],
                }

        except Exception as exc:
            logger.warning(f"NIC IRN API call failed: {exc}. Treating as blocking / MANUAL_REVIEW.")
            return {
                "api_called": True,
                "success": None,
                "env": env,
                "api_status": "API_ERROR",
                "detail": str(exc),
            }


    def verify_hsn_sac(self, db: Session, invoice: Invoice) -> Dict[str, Any]:
        """
        Validates the HSN codes on line items.
        """
        from app.core.config import CONFIG
        hsn_config = CONFIG.compliance_rules.get("hsn_sac", {}).get("local_lookup", {})
        
        report = []
        is_all_valid = True
        total_confidence = 0.0
        count = 0

        for item in invoice.items:
            hsn = item.hsn_code.strip() if item.hsn_code else ""
            if not hsn:
                continue
            
            count += 1
            code_exists = False
            gst_rate_matched = False
            description = "Unknown HSN Code"
            blocked_itc = False
            rcm_applicable = False
            confidence = 1.0

            # Check config local lookup first
            local_hsn = hsn_config.get(hsn)
            if local_hsn:
                code_exists = True
                description = local_hsn.get("description", "")
                expected_rate = local_hsn.get("gst_rate")
                item_rate = item.gst_rate or 0.0
                normalized_item_rate = item_rate * 100.0 if item_rate <= 1.0 else item_rate
                if abs(normalized_item_rate - expected_rate) <= 0.01:
                    gst_rate_matched = True
            else:
                # Check DB fallback
                hsn_record = db.query(HSNMaster).filter(HSNMaster.hsn_code == hsn).first()
                if hsn_record:
                    code_exists = True
                    description = hsn_record.description or ""
                    expected_rate = hsn_record.tax_rate or 0.0
                    item_rate = item.gst_rate or 0.0
                    normalized_item_rate = item_rate * 100.0 if item_rate <= 1.0 else item_rate
                    if abs(normalized_item_rate - expected_rate) <= 0.01:
                        gst_rate_matched = True
                else:
                    confidence = 0.5

            # Blocked ITC — check DB first, fall back to JSON-loaded set
            from app.models.gst_hsn_rule import GSTHsnRule as GSTHsnRuleModel
            db_blocked = {r.hsn_prefix for r in db.query(GSTHsnRuleModel).filter(GSTHsnRuleModel.rule_type == "BLOCKED_ITC").all()}
            db_rcm = {r.hsn_prefix for r in db.query(GSTHsnRuleModel).filter(GSTHsnRuleModel.rule_type == "RCM").all()}
            active_blocked = db_blocked if db_blocked else self.blocked_itc_hsn_codes
            active_rcm = db_rcm if db_rcm else self.rcm_hsn_codes

            if any(hsn.startswith(prefix) for prefix in active_blocked):
                blocked_itc = True

            # RCM HSN
            if any(hsn.startswith(prefix) for prefix in active_rcm):
                rcm_applicable = True

            if not code_exists or not gst_rate_matched:
                is_all_valid = False

            total_confidence += confidence
            report.append({
                "item_number": item.item_number,
                "hsn_code": hsn,
                "code_exists": code_exists,
                "gst_rate_matched": gst_rate_matched,
                "description": description,
                "category": "Blocked ITC" if blocked_itc else "Standard",
                "blocked_itc": blocked_itc,
                "rcm_applicable": rcm_applicable,
                "confidence": confidence
            })

        avg_confidence = round(total_confidence / max(count, 1), 2)

        return {
            "is_all_valid": is_all_valid,
            "average_confidence": avg_confidence,
            "report": report
        }

    def verify_gst_reconciliation(self, db: Session, invoice: Invoice) -> Dict[str, Any]:
        """
        Reconciles invoice-level GST values, extracted values, calculated values, and PO.
        """
        # Calculate rates based on line items
        calculated_cgst = 0.0
        calculated_sgst = 0.0
        calculated_igst = 0.0
        calculated_cess = 0.0
        calculated_taxable = 0.0

        for item in invoice.items:
            assessable = item.assessable_value or item.total_amount or 0.0
            calculated_taxable += assessable
            
            # Simple tax calculation
            rate = item.gst_rate or 0.0
            rate_frac = rate / 100.0 if rate > 1.0 else rate
            expected_tax = round(assessable * rate_frac, 2)
            
            # Interstate or intrastate
            seller_gst = invoice.seller_gstin.strip().upper() if invoice.seller_gstin else ""
            buyer_gst = invoice.buyer_gstin.strip().upper() if invoice.buyer_gstin else ""
            is_interstate = seller_gst[:2] != buyer_gst[:2] if (seller_gst and buyer_gst) else False
            
            if is_interstate:
                calculated_igst += expected_tax
            else:
                half_tax = round(expected_tax / 2.0, 2)
                calculated_cgst += half_tax
                calculated_sgst += half_tax

        inv_cgst = float(invoice.total_cgst_value or 0.0)
        inv_sgst = float(invoice.total_sgst_value or 0.0)
        inv_igst = float(invoice.total_igst_value or 0.0)
        inv_taxable = float(invoice.total_taxable_value or 0.0)

        invoice_gst = float(inv_cgst + inv_sgst + inv_igst)
        calculated_gst = float(calculated_cgst + calculated_sgst + calculated_igst)

        # PO reconciliation
        po_gst = 0.0
        po_found = False
        po_taxable = 0.0
        if invoice.po_number:
            po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == invoice.po_number).first()
            if po:
                po_found = True
                for po_item in po.items:
                    po_taxable += float(po_item.quantity * po_item.unit_price)
                    rate = po_item.tax_rate or 0.0
                    rate_val = rate / 100.0 if rate > 1.0 else rate
                    po_gst += round(po_item.quantity * po_item.unit_price * rate_val, 2)

        # Compute reconciliation %
        mismatch_summary = []
        # Read editable params from DB (with JSON fallback if settings row missing)
        from app.models.settings import Settings as DBSettings
        cfg = db.query(DBSettings).first()
        tolerance = cfg.gst_tolerance_amount if cfg else self.gst_rules.get("tolerance_amount", 1.0)
        reconcile_target = cfg.gst_reconciliation_threshold_pct if cfg else self.gst_rules.get("reconciliation_threshold_percentage", 98.0)

        # Check field-level diffs
        if abs(inv_taxable - calculated_taxable) > tolerance:
            mismatch_summary.append(f"Taxable amount mismatch: Invoice has {inv_taxable}, calculated has {calculated_taxable}")
        if abs(inv_cgst - calculated_cgst) > tolerance:
            mismatch_summary.append(f"CGST mismatch: Invoice has {inv_cgst}, calculated has {calculated_cgst}")
        if abs(inv_sgst - calculated_sgst) > tolerance:
            mismatch_summary.append(f"SGST mismatch: Invoice has {inv_sgst}, calculated has {calculated_sgst}")
        if abs(inv_igst - calculated_igst) > tolerance:
            mismatch_summary.append(f"IGST mismatch: Invoice has {inv_igst}, calculated has {calculated_igst}")
        if po_found and abs(invoice_gst - po_gst) > tolerance:
            mismatch_summary.append(f"GST mismatch with PO: Invoice GST has {invoice_gst}, Purchase Order GST has {po_gst}")

        # Compute % match
        diff = abs(invoice_gst - calculated_gst)
        if po_found:
            diff += abs(invoice_gst - po_gst)
            reconciliation_percentage = max(0.0, min(100.0, 100.0 - (diff / max(invoice_gst * 2, 1.0) * 100.0)))
        else:
            reconciliation_percentage = max(0.0, min(100.0, 100.0 - (diff / max(invoice_gst, 1.0) * 100.0)))

        reconciliation_percentage = round(reconciliation_percentage, 2)

        status = "PASS"
        if reconciliation_percentage < reconcile_target:
            status = "FAILED"
        elif len(mismatch_summary) > 0:
            status = "WARNING"

        severity = "LOW"
        if status == "FAILED":
            severity = "HIGH"
        elif status == "WARNING":
            severity = "MEDIUM"

        field_level_comparison = {
            "taxable_amount": { "invoice": invoice.total_taxable_value, "calculated": calculated_taxable, "po": po_taxable if po_found else 0.0 },
            "cgst": { "invoice": invoice.total_cgst_value, "calculated": calculated_cgst, "po": 0.0 },
            "sgst": { "invoice": invoice.total_sgst_value, "calculated": calculated_sgst, "po": 0.0 },
            "igst": { "invoice": invoice.total_igst_value, "calculated": calculated_igst, "po": 0.0 },
            "cess": { "invoice": invoice.total_ces_value, "calculated": calculated_cess, "po": 0.0 },
            "round_off": { "invoice": invoice.round_off_amount, "calculated": 0.0, "po": 0.0 }
        }

        if status == "PASS":
            recommendation = "GST details are matching perfectly. Ready for tax credit claim."
        elif status == "WARNING":
            recommendation = "Verify mismatched fields (cgst/sgst/igst) before filing GSTR-2B reconciliation."
        else:
            recommendation = "High risk discrepancy. Raise debit note or request vendor to revise invoice in GSTR-1."

        return {
            "reconciliation_percentage": reconciliation_percentage,
            "mismatch_summary": mismatch_summary,
            "field_level_comparison": field_level_comparison,
            "severity": severity,
            "status": status,
            "recommendation": recommendation
        }

    def verify_gst_compliance(self, db: Session, invoice: Invoice) -> Dict[str, Any]:
        """
        Verifies GST compliance across all engine sub-modules (GSTIN, HSN, RCM, IRN, Reconciliation).
        """
        errors = []
        warnings = []
        is_compliant = True

        seller_gst = invoice.seller_gstin.strip().upper() if invoice.seller_gstin else ""
        buyer_gst = invoice.buyer_gstin.strip().upper() if invoice.buyer_gstin else ""

        # GSTIN Validation
        if seller_gst:
            if not self.validate_gstin(seller_gst):
                errors.append(f"Seller GSTIN '{seller_gst}' format is invalid.")
                is_compliant = False
            else:
                state_code = seller_gst[:2]
                if state_code not in self.state_codes:
                    errors.append(f"Seller GSTIN state code '{state_code}' is invalid.")
                    is_compliant = False

        if buyer_gst:
            if not self.validate_gstin(buyer_gst):
                errors.append(f"Buyer GSTIN '{buyer_gst}' format is invalid.")
                is_compliant = False
            else:
                state_code = buyer_gst[:2]
                if state_code not in self.state_codes:
                    errors.append(f"Buyer GSTIN state code '{state_code}' is invalid.")
                    is_compliant = False

        # Run Sub-Engines
        rcm_report = self.verify_rcm(invoice)
        irn_report = self.verify_irn(db, invoice)
        hsn_report = self.verify_hsn_sac(db, invoice)
        recon_report = self.verify_gst_reconciliation(db, invoice)

        # Collect errors/warnings
        if rcm_report["rcm_applicable"]:
            warnings.append(f"RCM Applicable: {rcm_report['reason']}")
        
        if irn_report["status"] == "FAILED":
            is_compliant = False
            errors.extend(irn_report["errors"])
        elif irn_report["status"] == "WARNING":
            warnings.extend(irn_report["errors"])

        if not hsn_report["is_all_valid"]:
            warnings.append("Some HSN codes or rates do not match expected records.")

        if recon_report["status"] == "FAILED":
            is_compliant = False
            errors.extend(recon_report["mismatch_summary"])
        elif recon_report["status"] == "WARNING":
            warnings.extend(recon_report["mismatch_summary"])

        return {
            "is_compliant": is_compliant,
            "errors": errors,
            "warnings": warnings,
            "is_interstate": seller_gst[:2] != buyer_gst[:2] if (seller_gst and buyer_gst) else False,
            "rcm_applicable": rcm_report["rcm_applicable"],
            "rcm_reason": rcm_report["reason"],
            "itc_eligible": not any(item["blocked_itc"] for item in hsn_report["report"]),
            "irn_status": irn_report["status"],
            "gstr2b_status": "COMPLIANT_MATCHED" if recon_report["reconciliation_percentage"] >= 98.0 else "RECONCILIATION_MISMATCH",
            "invoice_gst": recon_report["field_level_comparison"]["cgst"]["invoice"] + recon_report["field_level_comparison"]["sgst"]["invoice"] + recon_report["field_level_comparison"]["igst"]["invoice"],
            "extracted_gst": recon_report["field_level_comparison"]["cgst"]["calculated"] + recon_report["field_level_comparison"]["sgst"]["calculated"] + recon_report["field_level_comparison"]["igst"]["calculated"],
            "po_gst": recon_report["field_level_comparison"]["cgst"]["po"] + recon_report["field_level_comparison"]["sgst"]["po"] + recon_report["field_level_comparison"]["igst"]["po"],
            "reconciliation_percentage": recon_report["reconciliation_percentage"],
            "total_calculated_cgst": recon_report["field_level_comparison"]["cgst"]["calculated"],
            "total_calculated_sgst": recon_report["field_level_comparison"]["sgst"]["calculated"],
            "total_calculated_igst": recon_report["field_level_comparison"]["igst"]["calculated"],
            "rcm": rcm_report,
            "irn": irn_report,
            "hsn": hsn_report,
            "reconciliation": recon_report
        }

