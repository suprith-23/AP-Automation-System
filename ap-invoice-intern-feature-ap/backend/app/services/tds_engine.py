"""TDS Calculation and Verification Engine."""
import re
import logging
from datetime import date
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.invoice import Invoice
from app.models.tds import TDSSection, TDSLedgerEntry

logger = logging.getLogger("tds.engine")

import json
import os
from pathlib import Path

class TDSEngine:
    def __init__(self):
        from app.core.config import CONFIG
        self.config = CONFIG.compliance_rules

    @staticmethod
    def validate_pan(pan: Optional[str]) -> bool:
        """
        Validate Indian PAN structure.
        Format: 5 letters, 4 digits, 1 letter.
        """
        if not pan:
            return False
        pan = pan.strip().upper()
        if len(pan) != 10:
            return False
        pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
        return bool(re.match(pattern, pan))

    @staticmethod
    def get_financial_year_range(invoice_date: date) -> tuple[date, date]:
        """
        Get the Indian Financial Year range (April 1 to March 31) for the given date.
        """
        year = invoice_date.year
        if invoice_date.month >= 4:
            start_date = date(year, 4, 1)
            end_date = date(year + 1, 3, 31)
        else:
            start_date = date(year - 1, 4, 1)
            end_date = date(year, 3, 31)
        return start_date, end_date

    def calculate_tds(
        self,
        db: Session,
        invoice: Invoice,
        section_code: Optional[str] = None,
        vendor_pan: Optional[str] = None,
        vendor_category: Optional[str] = None,
        actual_tds: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculate TDS deduction based on rules configuration and thresholds.
        Rules are loaded from the DB (org-scoped + global fallback rows where
        organization_id IS NULL).  Falls back to the static tds_rules.json only
        when the DB table is empty (e.g. pre-migration state).
        """
        import json as _json
        from app.models.tds import TDSRule

        org_id = getattr(invoice, "organization_id", None)
        db_rows = (
            db.query(TDSRule)
            .filter(
                (TDSRule.organization_id == org_id) | (TDSRule.organization_id == None)  # noqa: E711
            )
            .order_by(TDSRule.section_code)
            .all()
        )

        if db_rows:
            tds_rules = [
                {
                    "section_code": r.section_code,
                    "description": r.description or r.section_code,
                    "rate_with_pan": r.rate_with_pan,
                    "rate_without_pan": r.rate_without_pan,
                    "single_threshold": r.single_threshold,
                    "aggregate_threshold": r.aggregate_threshold,
                    "vendor_categories": _json.loads(r.vendor_categories) if r.vendor_categories else [],
                    "expense_categories": _json.loads(r.expense_categories) if r.expense_categories else [],
                    "effective_from": r.effective_from,
                    "effective_to": r.effective_to,
                }
                for r in db_rows
            ]
        else:
            # Fallback: static JSON (fresh install / pre-migration)
            from app.core.config import CONFIG
            tds_rules = CONFIG.tds_rules.get("rules", [])
        
        # 1. Resolve vendor category and expense category
        if not vendor_category and invoice.extracted_json:
            vendor_category = invoice.extracted_json.get("vendor_category")
        
        expense_category = None
        if invoice.extracted_json:
            expense_category = invoice.extracted_json.get("expense_category")

        invoice_date_val = invoice.invoice_date or date.today()
        invoice_date_str = invoice_date_val.isoformat()

        # 2. Match Rule Hierarchy
        matched_rule = None
        best_score = -1

        for rule in tds_rules:
            # Check effective dates
            eff_from = rule.get("effective_from")
            eff_to = rule.get("effective_to")
            if eff_from and invoice_date_str < eff_from:
                continue
            if eff_to and invoice_date_str > eff_to:
                continue

            score = 0
            # If section code is explicitly requested, it must match
            if section_code:
                if rule.get("section_code") == section_code:
                    score += 100
                else:
                    continue

            # Check vendor category match
            v_cats = rule.get("vendor_categories", [])
            if vendor_category and v_cats and any(v.lower() == vendor_category.lower() for v in v_cats):
                score += 10
            
            # Check expense category match
            e_cats = rule.get("expense_categories", [])
            if expense_category and e_cats and any(e.lower() == expense_category.lower() for e in e_cats):
                score += 10

            # If it's a fallback with matching section code
            if not section_code and rule.get("section_code") == "194C":
                score += 1

            if score > best_score:
                best_score = score
                matched_rule = rule

        # If no rule matched, fallback to first rule or 194C
        if not matched_rule:
            matched_rule = next((r for r in tds_rules if r.get("section_code") == "194C"), tds_rules[0] if tds_rules else {})

        sec_code = matched_rule.get("section_code", "194C")
        taxable_value = invoice.total_taxable_value or invoice.subtotal or 0.0

        # Validate PAN
        if not vendor_pan and invoice.extracted_json:
            vendor_pan = invoice.extracted_json.get("vendor_pan") or invoice.extracted_json.get("pan")
        is_pan_valid = self.validate_pan(vendor_pan)
        
        # Rate from rule is in percentage (e.g. 1.0 or 10.0)
        rate_percent = matched_rule.get("rate_with_pan", 1.0) if is_pan_valid else matched_rule.get("rate_without_pan", 20.0)
        
        # If rate is saved as fraction, normalize to percentage (excluding 194Q)
        if rate_percent < 0.5 and sec_code != "194Q":
            rate_percent = rate_percent * 100.0
            
        applicable_rate = rate_percent / 100.0

        # Determine if single invoice threshold is crossed
        single_breached = taxable_value >= matched_rule.get("single_threshold", 30000.0)

        # Determine if aggregate threshold is crossed
        start_fy, end_fy = self.get_financial_year_range(invoice_date_val)
        
        # Calculate YTD aggregate taxable amount for this vendor
        vendor_filter = Invoice.seller_gstin == invoice.seller_gstin if invoice.seller_gstin else Invoice.seller_name == invoice.seller_name
        
        aggregate_ytd = db.query(func.sum(Invoice.total_taxable_value)).filter(
            vendor_filter,
            Invoice.invoice_date >= start_fy,
            Invoice.invoice_date <= end_fy,
            Invoice.id != invoice.id
        ).scalar() or 0.0

        total_aggregate = aggregate_ytd + taxable_value
        aggregate_breached = total_aggregate >= matched_rule.get("aggregate_threshold", 100000.0)

        tds_applicable = single_breached or aggregate_breached
        expected_tds = 0.0
        reason = "Threshold not met for TDS deduction."

        if tds_applicable:
            expected_tds = round(taxable_value * applicable_rate, 2)
            reason = (
                f"TDS applicable under {sec_code}. "
                f"Single breached: {single_breached} (val: {taxable_value} >= {matched_rule.get('single_threshold')}), "
                f"Aggregate breached: {aggregate_breached} (YTD + current: {total_aggregate} >= {matched_rule.get('aggregate_threshold')}). "
                f"PAN Valid: {is_pan_valid}."
            )

        # Compare actual vs expected
        if actual_tds is None:
            if invoice.extracted_json:
                actual_tds = invoice.extracted_json.get("actual_tds_amount") or invoice.extracted_json.get("tds_amount")
            if actual_tds is None:
                actual_tds = 0.0
        else:
            actual_tds = float(actual_tds)

        variance = round(actual_tds - expected_tds, 2)
        if abs(variance) <= 0.01:
            status = "PASS"
            recommendation = "No action required. TDS deduction is aligned."
        elif abs(variance) <= 10.0:
            status = "WARNING"
            recommendation = "Review minor variance in TDS deduction. Consider adjustment in next payment."
        else:
            status = "FAILED"
            recommendation = f"Deduct TDS of {expected_tds} under Section {sec_code} instead of {actual_tds}."

        # Create or update TDS ledger entry
        if tds_applicable:
            ledger_entry = db.query(TDSLedgerEntry).filter(TDSLedgerEntry.invoice_id == invoice.id).first()
            if not ledger_entry:
                ledger_entry = TDSLedgerEntry(
                    invoice_id=invoice.id,
                    vendor_gstin=invoice.seller_gstin,
                    vendor_pan=vendor_pan,
                    section_code=sec_code,
                    taxable_amount=taxable_value,
                    tds_rate=applicable_rate,
                    tds_amount=expected_tds
                )
                db.add(ledger_entry)
            else:
                ledger_entry.vendor_pan = vendor_pan
                ledger_entry.taxable_amount = taxable_value
                ledger_entry.tds_rate = applicable_rate
                ledger_entry.tds_amount = expected_tds
                ledger_entry.section_code = sec_code
            db.commit()

        return {
            "tds_applicable": tds_applicable,
            "tds_amount": expected_tds,
            "expected_tds": expected_tds,
            "actual_tds": actual_tds,
            "variance": variance,
            "applicable_section": sec_code,
            "rule_matched": matched_rule.get("description", sec_code),
            "reason": reason,
            "pan_valid": is_pan_valid,
            "section_code": sec_code,
            "vendor_category": vendor_category,
            "status": status,
            "recommendation": recommendation
        }

