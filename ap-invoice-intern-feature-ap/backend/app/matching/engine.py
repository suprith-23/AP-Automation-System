"""Core decision engine for Purchase Order Matching."""
import re
import difflib
import logging
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.validation.service import ValidationService
from app.matching.config import MatchingConfig

logger = logging.getLogger("matching.engine")

class MatchingEngine:
    def __init__(self, config: Optional[MatchingConfig] = None, qty_tolerance: float = 0.05, price_tolerance: float = 0.02, tax_tolerance: float = 0.0, freight_tolerance: float = 50.0, db: Optional[Session] = None):
        self.config = config or MatchingConfig()
        self.qty_tolerance = qty_tolerance
        self.price_tolerance = price_tolerance
        self.tax_tolerance = tax_tolerance
        self.freight_tolerance = freight_tolerance
        self.db = db

        # Dynamically override config values using DB settings if db is provided
        if db:
            from app.models.settings import Settings
            settings = db.query(Settings).first()
            if settings:
                if settings.po_vendor_name_threshold_pct is not None:
                    self.config.vendor_name_threshold = settings.po_vendor_name_threshold_pct / 100.0
                if settings.po_min_match_score is not None:
                    self.config.min_match_score = settings.po_min_match_score


    def _normalize_name(self, name: str) -> str:
        name = name.upper()
        name = re.sub(r"[^\w\s]", "", name)
        name = re.sub(r"\s+", " ", name).strip()
        return name

    def _fuzzy_name_ratio(self, a: str, b: str) -> float:
        return difflib.SequenceMatcher(None, self._normalize_name(a), self._normalize_name(b)).ratio()

    def _parse_date(self, d_val) -> Optional[date]:
        if not d_val:
            return None
        if isinstance(d_val, date):
            return d_val
        if isinstance(d_val, datetime):
            return d_val.date()
        if isinstance(d_val, str):
            for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"]:
                try:
                    return datetime.strptime(d_val.strip(), fmt).date()
                except ValueError:
                    continue
            try:
                return datetime.fromisoformat(d_val.strip()).date()
            except ValueError:
                pass
        return None

    def _get_existing_spend(self, db: Session, po_number: str) -> float:
        from app.models.invoice import Invoice, InvoiceWorkflowStatus
        excluded_statuses = {
            InvoiceWorkflowStatus.rejected,
            InvoiceWorkflowStatus.validation_failed,
            InvoiceWorkflowStatus.validation_pending,
        }
        rows = (
            db.query(Invoice.total_invoice_value)
            .filter(
                Invoice.po_number == po_number,
                Invoice.workflow_status.notin_(excluded_statuses),
            )
            .all()
        )
        return sum(r[0] or 0.0 for r in rows)

    def match(self, invoice_data: dict, db: Session) -> dict:
        self.db = db
        # Overrides config values dynamically from DB settings
        from app.models.settings import Settings
        settings = db.query(Settings).first()
        if settings:
            if settings.po_vendor_name_threshold_pct is not None:
                self.config.vendor_name_threshold = settings.po_vendor_name_threshold_pct / 100.0
            if settings.po_min_match_score is not None:
                self.config.min_match_score = settings.po_min_match_score

        matched_fields = []
        mismatched_fields = []
        warnings = []
        errors = []
        manual_review_required = False
        cumulative_spend_exceeded = False
        
        po_number = invoice_data.get("po_number")
        if not po_number or not str(po_number).strip():
            return {
                "match_score": 0.0,
                "matched_fields": [],
                "mismatched_fields": ["po_number"],
                "warnings": ["No Purchase Order number provided in invoice."],
                "final_status": "NO_PO_FOUND",
                "manual_review_required": True,
                "matched": True,
                "errors": [],
                "status": "pending_review",
            }

        po_number_str = str(po_number).strip()
        # Query with for update to mimic lock behavior in matching_service.py
        po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_number_str).with_for_update().first()
        if not po:
            return {
                "match_score": 0.0,
                "matched_fields": [],
                "mismatched_fields": ["po_number"],
                "warnings": [f"Purchase Order '{po_number_str}' not found in database."],
                "final_status": "NO_PO_FOUND",
                "manual_review_required": True,
                "matched": False,
                "errors": [f"No Purchase Order found with number '{po_number_str}'"],
                "status": "rejected",
            }

        # 1. PO Status check
        if po.status == PurchaseOrderStatus.closed:
            warnings.append(f"Purchase Order '{po_number_str}' is closed.")
            errors.append(f"Purchase Order '{po_number_str}' is closed")
            manual_review_required = True

        # Calculate Scores
        # Total weight: 100 points
        # - Vendor Identity: 50 points
        # - Amount matching: 30 points
        # - Currency matching: 10 points
        # - Date matching: 10 points
        vendor_points = 0.0
        amount_points = 0.0
        currency_points = 0.0
        date_points = 0.0

        vendor_score_legacy = 0.0
        amount_score_legacy = 0.0

        # A. Vendor matching
        invoice_seller_gstin = str(invoice_data.get("seller_gstin") or "").strip()
        invoice_vendor_name = str(invoice_data.get("vendor_name") or invoice_data.get("seller_name") or "").strip()
        
        if po.vendor_gstin:
            po_gstin = str(po.vendor_gstin).strip()
            if invoice_seller_gstin.upper() == po_gstin.upper():
                vendor_points = 50.0
                vendor_score_legacy = 1.0
                matched_fields.append("vendor_gstin")
            else:
                mismatched_fields.append("vendor_gstin")
                msg = f"Seller GSTIN '{invoice_seller_gstin}' does not match PO Vendor GSTIN '{po_gstin}'."
                warnings.append(msg)
                errors.append(f"Invoice Seller GSTIN '{invoice_seller_gstin}' does not match PO Vendor GSTIN '{po_gstin}'")
                vendor_score_legacy = 0.0
        else:
            # Fuzzy match
            ratio = self._fuzzy_name_ratio(invoice_vendor_name, po.vendor_name)
            if ratio >= self.config.vendor_name_threshold:
                vendor_points = ratio * 50.0
                vendor_score_legacy = ratio
                matched_fields.append("vendor_name")
                if ratio < 1.0:
                    warnings.append(f"Fuzzy vendor name match similarity is {ratio:.0%}.")
            else:
                mismatched_fields.append("vendor_name")
                msg = f"Vendor Name '{invoice_vendor_name}' does not match PO Vendor '{po.vendor_name}' (similarity {ratio:.0%})."
                warnings.append(msg)
                errors.append(f"Vendor Name '{invoice_vendor_name}' does not sufficiently match PO Vendor '{po.vendor_name}' (similarity {ratio:.0%} < threshold {self.config.vendor_name_threshold:.0%})")
                vendor_score_legacy = 0.0

        # B. Amount matching
        invoice_amount = invoice_data.get("total_amount") or invoice_data.get("total_invoice_value")
        if invoice_amount is not None:
            try:
                inv_amt = float(invoice_amount)
                po_amt = float(po.po_amount)
                ceiling = po_amt * (1.0 + self.config.amount_tolerance)
                
                if inv_amt <= po_amt:
                    amount_points = 30.0
                    amount_score_legacy = 1.0
                    matched_fields.append("total_amount")
                elif inv_amt <= ceiling:
                    # Scale down score linearly from 30 to 15 points at tolerance ceiling
                    scale = (inv_amt - po_amt) / (po_amt * self.config.amount_tolerance)
                    amount_points = 30.0 - (scale * 15.0)
                    amount_score_legacy = 1.0 - scale * 0.5
                    amount_score_legacy = max(0.5, min(1.0, amount_score_legacy))
                    matched_fields.append("total_amount")
                    warnings.append(f"Invoice amount exceeds PO amount but is within tolerance (Invoice: {inv_amt:.2f}, PO: {po_amt:.2f}).")
                else:
                    mismatched_fields.append("total_amount")
                    warnings.append(f"Invoice amount {inv_amt:.2f} exceeds PO amount {po_amt:.2f} and ceiling of {ceiling:.2f}.")
                    errors.append(f"Invoice total {inv_amt:.2f} exceeds PO amount {po_amt:.2f} (allowed ceiling with {self.config.amount_tolerance:.0%} tolerance: {ceiling:.2f})")
                    amount_score_legacy = 0.0
            except (ValueError, TypeError):
                mismatched_fields.append("total_amount")
                warnings.append("Invalid total_amount format on invoice.")
                errors.append("Invalid total_amount format on invoice.")
                amount_score_legacy = 0.0
        else:
            mismatched_fields.append("total_amount")
            warnings.append("No total_amount found on invoice.")
            amount_score_legacy = 1.0  # no amount provided -> can't fail on it

        # C. Currency matching
        currency = str(invoice_data.get("currency") or "").strip().upper()
        if currency:
            if currency == self.config.default_currency.upper():
                currency_points = 10.0
                matched_fields.append("currency")
            else:
                mismatched_fields.append("currency")
                warnings.append(f"Invoice currency '{currency}' does not match PO currency '{self.config.default_currency}'.")
        else:
            mismatched_fields.append("currency")
            warnings.append("No currency found on invoice.")

        # D. Date matching (invoice date >= PO date)
        parsed_invoice_date = self._parse_date(invoice_data.get("invoice_date"))
        parsed_po_date = self._parse_date(po.po_date)

        if parsed_invoice_date and parsed_po_date:
            if parsed_invoice_date >= parsed_po_date:
                date_points = 10.0
                matched_fields.append("invoice_date")
            else:
                mismatched_fields.append("invoice_date")
                warnings.append(f"Invoice Date '{parsed_invoice_date}' is earlier than PO Date '{parsed_po_date}'.")
        else:
            mismatched_fields.append("invoice_date")
            warnings.append("Invoice Date or PO Date could not be verified.")

        # E. Cumulative Spend Guard
        if not errors and invoice_amount is not None:
            existing_spend = self._get_existing_spend(db, po_number_str)
            projected_spend = existing_spend + float(invoice_amount)
            allowed_ceiling = po.po_amount * (1.0 + self.config.amount_tolerance)
            if projected_spend > allowed_ceiling:
                msg = f"Cumulative invoiced amount {projected_spend:.2f} would exceed PO amount {po.po_amount:.2f} (existing spend: {existing_spend:.2f}, this invoice: {float(invoice_amount):.2f}, allowed ceiling: {allowed_ceiling:.2f})"
                errors.append(msg)
                warnings.append(msg)
                cumulative_spend_exceeded = True

        # Match score calculation
        match_score = vendor_points + amount_points + currency_points + date_points
        
        # Decision status mapping
        if "vendor_gstin" in mismatched_fields or "vendor_name" in mismatched_fields or "total_amount" in mismatched_fields or "currency" in mismatched_fields or cumulative_spend_exceeded:
            final_status = "MISMATCH"
            manual_review_required = True
        elif match_score < self.config.min_match_score:
            final_status = "MISMATCH"
            manual_review_required = True
        elif len(warnings) > 0 or manual_review_required:
            final_status = "MATCHED_WITH_WARNING"
            manual_review_required = True
        else:
            final_status = "MATCHED"

        # Legacy final scores and matching
        if errors:
            partial_score = (vendor_score_legacy * 0.6 + amount_score_legacy * 0.4) if vendor_score_legacy > 0 else 0.0
            legacy_match_score = round(partial_score, 4)
            legacy_matched = False
            legacy_status = "rejected"
        else:
            legacy_match_score = round(vendor_score_legacy * 0.6 + amount_score_legacy * 0.4, 4)
            legacy_matched = True
            legacy_status = "matched"

        return {
            "match_score": round(match_score, 2),
            "matched_fields": matched_fields,
            "mismatched_fields": mismatched_fields,
            "warnings": warnings,
            "final_status": final_status,
            "manual_review_required": manual_review_required,
            # Legacy fields for backward compatibility
            "matched": legacy_matched,
            "errors": errors,
            "status": legacy_status,
            "match_score_legacy": legacy_match_score,
        }

    def perform_line_matching(self, db: Session, invoice: Invoice, is_three_way: bool = True) -> dict:
        from app.models.invoice_item import InvoiceItem
        from app.models.purchase_order import PurchaseOrder
        from app.models.po_item import PurchaseOrderItem, GRN, GRNItem

        mismatch_reasons = []
        matched_items = []
        warnings = []

        po_num = invoice.po_number
        if not po_num:
            return {
                "match_status": "FAILED",
                "match_score": 0.0,
                "mismatch_reasons": ["Invoice does not contain a PO Number."],
                "warnings": [],
                "is_three_way": is_three_way
            }

        po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_num).first()
        if not po:
            return {
                "match_status": "FAILED",
                "match_score": 0.0,
                "mismatch_reasons": [f"Purchase Order '{po_num}' not found in database."],
                "warnings": [],
                "is_three_way": is_three_way
            }

        # Fetch PO items
        po_items = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.po_id == po.id).all()
        po_items_map = {item.item_number or i+1: item for i, item in enumerate(po_items)}

        # Fetch GRN items if 3-way
        grn_items_map = {}
        if is_three_way:
            grns = db.query(GRN).filter(GRN.po_number == po_num).all()
            grn_ids = [g.id for g in grns]
            if grn_ids:
                grn_items = db.query(GRNItem).filter(GRNItem.grn_id.in_(grn_ids)).all()
                for gi in grn_items:
                    item_num = gi.item_number or 1
                    if item_num not in grn_items_map:
                        grn_items_map[item_num] = 0.0
                    grn_items_map[item_num] += gi.quantity_accepted
            else:
                warnings.append("No Goods Receipt Notes (GRN) found for 3-way matching. Falling back to 2-way rules.")
                is_three_way = False

        # Match invoice items
        invoice_items = invoice.items
        if not invoice_items:
            mismatch_reasons.append("Invoice contains no line items to match.")
            return {
                "match_status": "MISMATCH",
                "match_score": 0.0,
                "mismatch_reasons": mismatch_reasons,
                "warnings": warnings,
                "is_three_way": is_three_way
            }

        matched_count = 0
        total_items = len(invoice_items)

        for inv_item in invoice_items:
            item_num = inv_item.item_number or inv_item.id
            
            po_item = po_items_map.get(item_num)
            if not po_item and inv_item.hsn_code:
                po_item = next((pi for pi in po_items if pi.hsn_code == inv_item.hsn_code), None)
            if not po_item and inv_item.description:
                po_item = next((pi for pi in po_items if pi.description and inv_item.description.lower() in pi.description.lower()), None)

            if not po_item:
                mismatch_reasons.append(f"Line item {item_num} ('{inv_item.description or ''}'): No corresponding PO line item found.")
                continue

            # Verify Price
            price_diff = inv_item.unit_price - po_item.unit_price
            price_tolerance_limit = po_item.unit_price * self.price_tolerance
            if price_diff > price_tolerance_limit:
                mismatch_reasons.append(
                    f"Line item {item_num}: Unit price '{inv_item.unit_price}' exceeds PO price '{po_item.unit_price}' "
                    f"beyond tolerance of {self.price_tolerance * 100}%."
                )

            # Verify Quantity (2-Way)
            qty_breached = False
            qty_diff = inv_item.quantity - po_item.quantity
            qty_tolerance_limit = po_item.quantity * self.qty_tolerance
            if qty_diff > qty_tolerance_limit:
                qty_breached = True
                mismatch_reasons.append(
                    f"Line item {item_num}: Invoice quantity '{inv_item.quantity}' exceeds PO quantity '{po_item.quantity}' "
                    f"beyond tolerance of {self.qty_tolerance * 100}%."
                )

            # Verify Quantity against GRN (3-Way)
            if is_three_way:
                grn_qty = grn_items_map.get(po_item.item_number or item_num, 0.0)
                grn_qty_diff = inv_item.quantity - grn_qty
                grn_qty_tolerance_limit = grn_qty * self.qty_tolerance
                if grn_qty_diff > grn_qty_tolerance_limit:
                    qty_breached = True
                    mismatch_reasons.append(
                        f"Line item {item_num}: Invoice quantity '{inv_item.quantity}' exceeds GRN accepted quantity '{grn_qty}' "
                        f"beyond tolerance of {self.qty_tolerance * 100}%."
                    )

            # Verify Tax Rate
            po_tax = po_item.tax_rate / 100.0 if po_item.tax_rate > 1.0 else po_item.tax_rate
            inv_tax = inv_item.gst_rate / 100.0 if inv_item.gst_rate > 1.0 else inv_item.gst_rate
            if abs(po_tax - inv_tax) > self.tax_tolerance:
                mismatch_reasons.append(
                    f"Line item {item_num}: Invoice tax rate '{inv_tax * 100}%' does not match PO tax rate '{po_tax * 100}%'."
                )

            if not qty_breached and price_diff <= price_tolerance_limit:
                matched_count += 1
                matched_items.append({
                    "invoice_item_id": inv_item.id,
                    "po_item_id": po_item.id,
                    "quantity": inv_item.quantity,
                    "unit_price": inv_item.unit_price
                })

        match_score = (matched_count / total_items) * 100.0 if total_items > 0 else 0.0
        
        if len(mismatch_reasons) == 0:
            status = "MATCHED"
        elif matched_count > 0:
            status = "PARTIAL_MATCH"
        else:
            status = "MISMATCH"

        return {
            "match_status": status,
            "match_score": round(match_score, 2),
            "mismatch_reasons": mismatch_reasons,
            "warnings": warnings,
            "is_three_way": is_three_way,
            "matched_items": matched_items
        }
