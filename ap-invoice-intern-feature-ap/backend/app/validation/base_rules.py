"""Base rules for invoice validation."""
from datetime import date, datetime

def validate_base_fields(invoice_data: dict) -> list:
    """
    Purpose:
        Validates basic invoice fields such as invoice number, date, and basic invoice value.
    Inputs:
        - invoice_data (dict): A dictionary containing the invoice fields.
    Outputs:
        - list: A list of validation error messages (list of str).
    """
    errors = []
    
    # Check invoice number existence
    invoice_number = invoice_data.get("invoice_number")
    if not invoice_number or not str(invoice_number).strip():
        errors.append("invoice_number must exist")

    # Check invoice date existence
    invoice_date = invoice_data.get("invoice_date")
    if not invoice_date:
        errors.append("invoice_date must exist")
    else:
        parsed_date = None
        if isinstance(invoice_date, str):
            try:
                if "T" in invoice_date:
                    parsed_date = datetime.fromisoformat(invoice_date).date()
                else:
                    parsed_date = date.fromisoformat(invoice_date)
            except ValueError:
                pass
        elif isinstance(invoice_date, datetime):
            parsed_date = invoice_date.date()
        elif isinstance(invoice_date, date):
            parsed_date = invoice_date
        
        if parsed_date and parsed_date > date.today():
            errors.append("invoice_date cannot be in the future")

    # Check total invoice value basic condition
    total_invoice_value = invoice_data.get("total_invoice_value")
    if total_invoice_value is None or float(total_invoice_value) <= 0:
        errors.append("total_invoice_value must be greater than zero")

    # Check seller name existence
    seller_name = invoice_data.get("seller_name")
    if not seller_name or not str(seller_name).strip():
        errors.append("seller_name must exist")

    # Check buyer name existence
    buyer_name = invoice_data.get("buyer_name")
    if not buyer_name or not str(buyer_name).strip():
        errors.append("buyer_name must exist")

    # Check currency existence and consistency (3-letter ISO code)
    currency = invoice_data.get("currency")
    if not currency or not str(currency).strip():
        errors.append("currency must exist")
    else:
        currency_str = str(currency).strip()
        if len(currency_str) != 3 or not currency_str.isalpha():
            errors.append("currency must be a valid 3-letter ISO code")

    return errors
