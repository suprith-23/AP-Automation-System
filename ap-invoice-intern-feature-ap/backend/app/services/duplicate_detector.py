"""Duplicate Invoice Detection Service."""
import difflib
import logging
from datetime import timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.invoice import Invoice

logger = logging.getLogger("duplicate.detector")

class DuplicateDetector:
    def __init__(self, amount_tolerance: float = 0.005, date_tolerance_days: int = 30, ocr_similarity_threshold: float = 0.85):
        self.amount_tolerance = amount_tolerance
        self.date_tolerance_days = date_tolerance_days
        self.ocr_similarity_threshold = ocr_similarity_threshold

    def check_duplicates(self, db: Session, invoice: Invoice) -> Dict[str, Any]:
        """
        Check for potential duplicate invoices in the database.
        Returns check statuses, duplicate details, and AI confidence levels.
        """
        duplicate_detected = False
        reasons = []
        duplicate_invoice_ids = []

        inv_num = invoice.invoice_number
        seller_gstin = invoice.seller_gstin
        inv_date = invoice.invoice_date
        inv_amount = invoice.total_invoice_value or invoice.total_amount or 0.0

        if not inv_num:
            return {
                "duplicate_detected": False,
                "confidence": "LOW",
                "reasons": ["Invoice number is missing; skipping duplicate checks."],
                "duplicate_invoice_ids": []
            }

        # 1. Exact Match: Same Invoice Number + Same Seller GSTIN (or same vendor name)
        exact_query = db.query(Invoice).filter(
            Invoice.invoice_number == inv_num,
            Invoice.id != invoice.id
        )
        if seller_gstin:
            exact_query = exact_query.filter(
                or_(
                    Invoice.seller_gstin == seller_gstin,
                    Invoice.seller_name == invoice.seller_name
                )
            )
        else:
            exact_query = exact_query.filter(Invoice.seller_name == invoice.seller_name)

        exact_match = exact_query.first()
        if exact_match:
            duplicate_detected = True
            reasons.append(f"Exact match found: invoice '{inv_num}' already exists from vendor '{invoice.seller_name}' (ID: {exact_match.id}).")
            duplicate_invoice_ids.append(exact_match.id)
            return {
                "duplicate_detected": True,
                "confidence": "HIGH",
                "reasons": reasons,
                "duplicate_invoice_ids": duplicate_invoice_ids
            }

        # 2. Similarity/Fuzzy Match: Same vendor, close invoice date, close/matching amount
        if inv_date:
            min_date = inv_date - timedelta(days=self.date_tolerance_days)
            max_date = inv_date + timedelta(days=self.date_tolerance_days)

            # Query invoices within date window
            similar_query = db.query(Invoice).filter(
                Invoice.id != invoice.id,
                Invoice.invoice_date >= min_date,
                Invoice.invoice_date <= max_date
            )
            if seller_gstin:
                similar_query = similar_query.filter(Invoice.seller_gstin == seller_gstin)
            else:
                similar_query = similar_query.filter(Invoice.seller_name == invoice.seller_name)

            potential_matches = similar_query.all()
            for pot in potential_matches:
                pot_amt = pot.total_invoice_value or pot.total_amount or 0.0
                
                # Check amount similarity
                if inv_amount > 0 and pot_amt > 0:
                    diff_pct = abs(inv_amount - pot_amt) / inv_amount
                    if diff_pct <= self.amount_tolerance:
                        duplicate_detected = True
                        reasons.append(
                            f"Fuzzy match: Invoice from same vendor '{invoice.seller_name}' "
                            f"found on '{pot.invoice_date}' with similar amount '{pot_amt}' "
                            f"(difference of {diff_pct*100:.2f}%) (ID: {pot.id})."
                        )
                        duplicate_invoice_ids.append(pot.id)

                # Check OCR text similarity if present
                if invoice.raw_ocr_text and pot.raw_ocr_text:
                    sim = difflib.SequenceMatcher(None, invoice.raw_ocr_text, pot.raw_ocr_text).ratio()
                    if sim >= self.ocr_similarity_threshold:
                        duplicate_detected = True
                        reasons.append(
                            f"OCR text similarity: High textual similarity of {sim*100:.1f}% "
                            f"with invoice ID {pot.id}."
                        )
                        if pot.id not in duplicate_invoice_ids:
                            duplicate_invoice_ids.append(pot.id)

        confidence = "LOW"
        if duplicate_detected:
            # If we matched on exact criteria or high OCR, confidence is high, otherwise medium
            confidence = "HIGH" if any("Exact" in r or "OCR" in r for r in reasons) else "MEDIUM"

        return {
            "duplicate_detected": duplicate_detected,
            "confidence": confidence,
            "reasons": reasons,
            "duplicate_invoice_ids": duplicate_invoice_ids
        }
