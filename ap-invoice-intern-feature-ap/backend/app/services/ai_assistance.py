"""AI Ingestion Assistance and Insights Service."""
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.invoice import Invoice

logger = logging.getLogger("ai.assistance")

class AIAssistanceService:
    def explain_confidence(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Explains extraction confidence levels per field.
        """
        score = invoice.confidence_score or 0.0
        conf_json = invoice.confidence_json or {}
        
        explanations = {}
        for field, f_score in conf_json.items():
            if f_score >= 0.85:
                explanations[field] = "High: Text printed clearly, layout highly standard."
            elif f_score >= 0.60:
                explanations[field] = "Medium: Slight distortion or handwriting detection nearby."
            else:
                explanations[field] = "Low: Low contrast or potential OCR smudge. Review recommended."

        return {
            "overall_score": score,
            "field_explanations": explanations
        }

    def suggest_missing_fields(self, invoice: Invoice) -> List[Dict[str, Any]]:
        """
        Analyzes invoice for missing fields and returns suggestions using raw text pattern search.
        """
        suggestions = []
        raw_text = invoice.raw_ocr_text or ""

        if not invoice.po_number:
            # Look for typical PO patterns (e.g., PO-XXXX or Purchase Order followed by numbers)
            import re
            po_match = re.search(r"(?:PO|P\.O\.|Purchase Order)\s*[:#\-]?\s*([A-Za-z0-9\-]+)", raw_text, re.IGNORECASE)
            if po_match:
                suggestions.append({
                    "field": "po_number",
                    "suggested_value": po_match.group(1),
                    "confidence": 0.75,
                    "explanation": f"Matched pattern '{po_match.group(0)}' in raw OCR text."
                })

        if not invoice.invoice_date:
            import re
            date_match = re.search(r"(?:Date|Invoice Date)\s*[:\-]?\s*(\d{2}[/\-]\d{2}[/\-]\d{4}|\d{4}[/\-]\d{2}[/\-]\d{2})", raw_text, re.IGNORECASE)
            if date_match:
                suggestions.append({
                    "field": "invoice_date",
                    "suggested_value": date_match.group(1),
                    "confidence": 0.80,
                    "explanation": f"Matched date pattern '{date_match.group(0)}' in text."
                })

        return suggestions

    def classify_invoice(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Classifies invoice type (e.g. Utility, Tax Invoice, Logistic/Freight, Service Invoice).
        """
        raw_text = (invoice.raw_ocr_text or "").lower()
        
        classification = "TAX_INVOICE"
        confidence = 0.90

        if "electric" in raw_text or "utility" in raw_text or "power grid" in raw_text or "water charge" in raw_text:
            classification = "UTILITY_INVOICE"
            confidence = 0.85
        elif "freight" in raw_text or "logistics" in raw_text or "transport" in raw_text or "shipping charges" in raw_text:
            classification = "LOGISTIC_INVOICE"
            confidence = 0.88
        elif "consulting" in raw_text or "service fees" in raw_text or "manpower" in raw_text:
            classification = "SERVICE_INVOICE"
            confidence = 0.80

        return {
            "invoice_id": invoice.id,
            "classification": classification,
            "confidence_score": confidence
        }

    def generate_ai_summary(self, invoice: Invoice) -> str:
        """
        Returns a short semantic summary of the invoice details.
        """
        vendor = invoice.seller_name or invoice.vendor_name or "Unknown Vendor"
        amount = invoice.total_invoice_value or invoice.total_amount or 0.0
        po = f"referencing PO '{invoice.po_number}'" if invoice.po_number else "without a PO reference"
        inv_date = invoice.invoice_date or "an unknown date"
        
        return f"Invoice from '{vendor}' on {inv_date} totaling {amount} {po}. Ingestion status is currently: {invoice.status}."
