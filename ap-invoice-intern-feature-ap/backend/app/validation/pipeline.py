"""Pipeline to orchestrate invoice validation rules."""

from typing import Callable, Optional
from app.validation.base_rules import validate_base_fields
from app.validation.master_data_rule import validate_master_data_rules
from app.validation.tax_math_machine import validate_tax_math_rules

def validate_invoice(invoice_data: dict, hsn_lookup_fn: Optional[Callable[[str], dict]] = None) -> dict:
    """
    Purpose:
        Aggregates all validation rules (base fields, master data, and tax math checks) into a consolidated response pipeline.
    Inputs:
        - invoice_data (dict): A dictionary containing the invoice fields.
        - db (Session): Optional database session to validate HSN codes.
    Outputs:
        - dict: A dictionary with keys 'passed' (bool) and 'errors' (list of str).
    """
    errors = []

    # Run the base rule validation checks
    base_errors = validate_base_fields(invoice_data)
    errors.extend(base_errors)

    # Run the master data and fallback validation checks
    master_errors = validate_master_data_rules(invoice_data)
    errors.extend(master_errors)

    # Run the tax math and routing checks
    tax_errors = validate_tax_math_rules(invoice_data)
    errors.extend(tax_errors)

    # Run database HSN validations if the lookup callback is provided
    if hsn_lookup_fn is not None:
        items = invoice_data.get("items") or []
        for item in items:
            hsn_code = item.get("hsn_code")
            if hsn_code:
                hsn_res = hsn_lookup_fn(str(hsn_code))
                if not hsn_res["is_valid"]:
                    errors.append(f"Item HSN code '{hsn_code}' validation failed: {hsn_res['error_message']}")
                else:
                    official_rate = hsn_res["tax_rate"]
                    if official_rate is not None:
                        item_rate = item.get("gst_rate")
                        if item_rate is not None and float(item_rate) != float(official_rate):
                            errors.append(
                                f"Item HSN '{hsn_code}' GST rate mismatch: "
                                f"invoice GST rate is {item_rate}%, but official GST rate is {official_rate}%"
                            )
                    
                    # Verify CGST/SGST/IGST sub-rate compliance if assessable_value is present and positive
                    assessable_val = float(item.get("assessable_value") or 0.0)
                    if assessable_val > 0.0:
                        cgst_amt = float(item.get("cgst_amount") or 0.0)
                        sgst_amt = float(item.get("sgst_amount") or 0.0)
                        igst_amt = float(item.get("igst_amount") or 0.0)
                        
                        # Verify CGST compliance
                        if cgst_amt > 0.0:
                            official_cgst = hsn_res.get("cgst_rate")
                            if official_cgst is not None:
                                effective_cgst = (cgst_amt / assessable_val) * 100.0
                                if abs(effective_cgst - float(official_cgst)) > 0.1:
                                    errors.append(
                                        f"Item HSN '{hsn_code}' CGST rate compliance mismatch: "
                                        f"calculated CGST rate is {effective_cgst:.2f}%, but official CGST rate is {official_cgst}%"
                                    )
                                    
                        # Verify SGST compliance
                        if sgst_amt > 0.0:
                            official_sgst = hsn_res.get("sgst_rate")
                            if official_sgst is not None:
                                effective_sgst = (sgst_amt / assessable_val) * 100.0
                                if abs(effective_sgst - float(official_sgst)) > 0.1:
                                    errors.append(
                                        f"Item HSN '{hsn_code}' SGST rate compliance mismatch: "
                                        f"calculated SGST rate is {effective_sgst:.2f}%, but official SGST rate is {official_sgst}%"
                                    )
                                    
                        # Verify IGST compliance
                        if igst_amt > 0.0:
                            official_igst = hsn_res.get("igst_rate")
                            if official_igst is not None:
                                effective_igst = (igst_amt / assessable_val) * 100.0
                                if abs(effective_igst - float(official_igst)) > 0.1:
                                    errors.append(
                                        f"Item HSN '{hsn_code}' IGST rate compliance mismatch: "
                                        f"calculated IGST rate is {effective_igst:.2f}%, but official IGST rate is {official_igst}%"
                                    )

    return {
        "passed": len(errors) == 0,
        "errors": errors
    }
