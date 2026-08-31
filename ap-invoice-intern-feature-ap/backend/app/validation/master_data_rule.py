"""Master data rules for invoice validation."""

import re

def is_valid_state_code(gstin: str) -> bool:
    """
    Purpose:
        Checks if the state code (first 2 digits of GSTIN) matches one of the official Indian GST state codes.
    Inputs:
        - gstin (str): A 15-character GSTIN string.
    Outputs:
        - bool: True if the state code is valid, False otherwise.
    """
    import os
    env_codes = os.getenv("GST_VALID_STATE_CODES")
    if env_codes:
        valid_state_codes = {code.strip() for code in env_codes.split(",") if code.strip()}
    else:
        # Set of valid state codes in India for GST validation
        valid_state_codes = {
            "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
            "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
            "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
            "33", "34", "35", "36", "37", "38", "97", "99"
        }

    
    if len(gstin) < 2:
        return False
        
    state_code = gstin[:2]
    return state_code in valid_state_codes

def validate_master_data_rules(invoice_data: dict) -> list:
    """
    Purpose:
        Validates master data details including GSTIN formats, official state codes, and checks fallback requirements for backward compatibility.
    Inputs:
        - invoice_data (dict): A dictionary containing the invoice fields.
    Outputs:
        - list: A list of validation error messages (list of str).
    """
    errors = []
    
    # 15-character Indian GSTIN regex structure
    gstin_regex = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"

    # Validate Seller GSTIN
    seller_gstin = invoice_data.get("seller_gstin")
    if not seller_gstin or not str(seller_gstin).strip():
        errors.append("seller_gstin must exist")
    else:
        seller_gstin_str = str(seller_gstin).strip()
        if not re.match(gstin_regex, seller_gstin_str, re.IGNORECASE):
            errors.append("seller_gstin must match GSTIN format")
        elif not is_valid_state_code(seller_gstin_str):
            errors.append(f"seller_gstin state code '{seller_gstin_str[:2]}' is not a valid Indian state code")

    # Validate Buyer GSTIN
    buyer_gstin = invoice_data.get("buyer_gstin")
    if not buyer_gstin or not str(buyer_gstin).strip():
        errors.append("buyer_gstin must exist")
    else:
        buyer_gstin_str = str(buyer_gstin).strip()
        if not re.match(gstin_regex, buyer_gstin_str, re.IGNORECASE):
            errors.append("buyer_gstin must match GSTIN format")
        elif not is_valid_state_code(buyer_gstin_str):
            errors.append(f"buyer_gstin state code '{buyer_gstin_str[:2]}' is not a valid Indian state code")

    # Validate Shipping GSTIN (optional but must match format if present)
    shipping_gstin = invoice_data.get("shipping_gstin")
    if shipping_gstin and str(shipping_gstin).strip():
        shipping_gstin_str = str(shipping_gstin).strip()
        if not re.match(gstin_regex, shipping_gstin_str, re.IGNORECASE):
            errors.append("shipping_gstin must match GSTIN format")
        elif not is_valid_state_code(shipping_gstin_str):
            errors.append(f"shipping_gstin state code '{shipping_gstin_str[:2]}' is not a valid Indian state code")

    # Validate Entity Names correspond to GSTINs (prevent displaying GSTIN alone)
    seller_name = invoice_data.get("seller_name")
    if seller_gstin and not (seller_name and str(seller_name).strip()):
        errors.append("seller_name must exist when seller_gstin is provided")

    buyer_name = invoice_data.get("buyer_name")
    if buyer_gstin and not (buyer_name and str(buyer_name).strip()):
        errors.append("buyer_name must exist when buyer_gstin is provided")

    shipping_name = invoice_data.get("shipping_name")
    if shipping_gstin and not (shipping_name and str(shipping_name).strip()):
        errors.append("shipping_name must exist when shipping_gstin is provided")

    # Validate Backward Compatibility Fallback for vendor_name
    vendor_name = invoice_data.get("vendor_name")
    if not vendor_name or not str(vendor_name).strip():
        if not seller_gstin or not str(seller_gstin).strip():
            errors.append("vendor_name must exist")

    # Validate Backward Compatibility Fallback for total_amount
    total_amount = invoice_data.get("total_amount")
    if total_amount is None or float(total_amount) <= 0:
        total_invoice_value = invoice_data.get("total_invoice_value")
        if total_invoice_value is None or float(total_invoice_value) <= 0:
            errors.append("total_amount must be greater than zero")

    return errors
