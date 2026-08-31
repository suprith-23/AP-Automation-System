from typing import Dict, Any, List

class Stage9Validation:
    """
    Deterministic rule validation engine.
    Validates LLM output against accounting and formatting rules.
    Returns validation errors rather than silently fixing them.
    """

    @staticmethod
    def validate_invoice(invoice_data: Dict[str, Any]) -> List[str]:
        """
        Validates invoice data logic. Returns a list of error strings if any.
        """
        errors = []
        
        # 1. Mandatory Fields
        mandatory = ["invoice_number", "invoice_date", "total_invoice_value"]
        for m in mandatory:
            if not invoice_data.get(m):
                errors.append(f"Missing mandatory field: {m}")

        # 2. GST Math
        taxable = float(invoice_data.get("total_taxable_value") or 0.0)
        cgst = float(invoice_data.get("total_cgst_value") or 0.0)
        sgst = float(invoice_data.get("total_sgst_value") or 0.0)
        igst = float(invoice_data.get("total_igst_value") or 0.0)
        cess = float(invoice_data.get("total_ces_value") or 0.0)
        grand_total = float(invoice_data.get("total_invoice_value") or 0.0)
        
        calculated_total = taxable + cgst + sgst + igst + cess
        
        # Allow small floating point tolerance
        if grand_total > 0 and abs(grand_total - calculated_total) > 1.0:
            errors.append(f"Total mismatch: Taxable ({taxable}) + Taxes ({cgst+sgst+igst+cess}) != Total ({grand_total})")

        # 4. Deterministic Totals Cross-Check (Totals Hallucination Prevention)
        subtotal = float(invoice_data.get("subtotal") or invoice_data.get("total_taxable_value") or 0.0)
        tax_amount = float(invoice_data.get("tax_amount") or (cgst + sgst + igst + cess) or 0.0)
        if subtotal > 0 and tax_amount > 0 and grand_total > 0:
            expected_total = subtotal + tax_amount
            if abs(grand_total - expected_total) > 1.0:
                errors.append(f"Totals hallucination cross-check failed: Subtotal ({subtotal}) + Tax ({tax_amount}) != Total ({grand_total})")

        # 3. GSTIN Format (basic)
        seller_gstin = invoice_data.get("seller_gstin")
        if seller_gstin and len(seller_gstin) != 15:
            errors.append(f"Invalid Seller GSTIN length: {seller_gstin}")

        buyer_gstin = invoice_data.get("buyer_gstin")
        if buyer_gstin and len(buyer_gstin) != 15:
            errors.append(f"Invalid Buyer GSTIN length: {buyer_gstin}")

        return errors
