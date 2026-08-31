"""Tax and mathematical validation rules."""

import math
import os

def safe_float(val) -> float:
    if val is None:
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def validate_tax_math_rules(invoice_data: dict) -> list:
    """
    Purpose:
        Validates state-code tax routing (intra-state vs inter-state) and math total calculations.
    Inputs:
        - invoice_data (dict): A dictionary containing the invoice fields.
    Outputs:
        - list: A list of validation error messages (list of str).
    """
    errors = []
    
    seller_gstin = invoice_data.get("seller_gstin")
    buyer_gstin = invoice_data.get("buyer_gstin")
    shipping_gstin = invoice_data.get("shipping_gstin")
    total_invoice_value = invoice_data.get("total_invoice_value")
    
    
    # Tolerance margin constant (configurable via environment variable)
    try:
        from app.core.config import CONFIG
        TOLERANCE = float(os.getenv("TAX_TOLERANCE_LIMIT", str(CONFIG.validation_rules.get("tax_math_tolerance", 1.00))))
    except ValueError:
        TOLERANCE = 1.00


    # Only execute tax and math validations if both seller and buyer GSTINs are provided
    if seller_gstin and buyer_gstin:
        # Determine Place of Supply (POS)
        pos_gstin = shipping_gstin if (shipping_gstin and str(shipping_gstin).strip()) else buyer_gstin
        
        # Extract state codes (first two characters)
        seller_state_code = str(seller_gstin).strip()[:2]
        pos_state_code = str(pos_gstin).strip()[:2]

        # Extract tax values, defaulting to 0.0
        cgst = safe_float(invoice_data.get("total_cgst_value"))
        sgst = safe_float(invoice_data.get("total_sgst_value"))
        igst = safe_float(invoice_data.get("total_igst_value"))
        taxable_value = safe_float(invoice_data.get("total_taxable_value"))

        # Rule A: Intra-State (Same state codes)
        if seller_state_code == pos_state_code:
            if igst > 0:
                errors.append(f"Intra-state transaction (State {seller_state_code}): total_igst_value must be 0.")
            if cgst == 0 and sgst == 0 and taxable_value > 0:
                errors.append("Intra-state transaction: CGST and SGST must be declared.")
            if not math.isclose(cgst, sgst, abs_tol=TOLERANCE):
                errors.append(f"CGST ({cgst}) and SGST ({sgst}) must be equal within {TOLERANCE} tolerance.")
        
        # Rule B: Inter-State (Different state codes)
        else:
            if cgst > 0 or sgst > 0:
                errors.append(f"Inter-state transaction ({seller_state_code} to {pos_state_code}): CGST and SGST must be 0.")
            if igst == 0 and taxable_value > 0:
                errors.append("Inter-state transaction: IGST must be greater than 0.")

        # Rule C: Header Math Verification
        cess = safe_float(invoice_data.get("total_ces_value"))
        discount = safe_float(invoice_data.get("total_discount_value"))
        round_off = safe_float(invoice_data.get("round_off_amount"))
        
        expected_total = taxable_value + cgst + sgst + igst + cess - discount + round_off
        
        if total_invoice_value is not None:
            try:
                tot_val = float(total_invoice_value)
                if not math.isclose(tot_val, expected_total, abs_tol=TOLERANCE):
                    errors.append(
                        f"Header math mismatch: expected {expected_total:.2f}, got {total_invoice_value}. "
                        "Check taxes, discount, and round_off."
                    )
            except (ValueError, TypeError):
                errors.append(f"Header total_invoice_value '{total_invoice_value}' is not a valid number.")

    return errors
