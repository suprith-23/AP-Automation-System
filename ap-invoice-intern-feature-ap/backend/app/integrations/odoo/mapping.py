from typing import Dict, Any, List
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem

def map_invoice_to_odoo_bill(invoice: Invoice, partner_id: int, lines: List[InvoiceItem], tax_mapping: Dict[float, List[int]] = None) -> Dict[str, Any]:
    """
    Translates an internal Invoice record and its line items to Odoo's account.move payload structure.
    
    Odoo line items syntax in execute_kw uses:
    (0, 0, values) -> Create a new nested record with values.
    """
    if tax_mapping is None:
        # Default mapping of tax rates to Odoo tax IDs if known, otherwise empty
        tax_mapping = {}

    invoice_lines = []
    for line in lines:
        line_tax_ids = []
        # Find matching tax IDs if configured for the given tax rate
        tax_rate_percent = getattr(line, "tax_rate", 0.0) * 100.0
        for rate, ids in tax_mapping.items():
            if abs(rate - tax_rate_percent) < 0.01:
                line_tax_ids = [[6, 0, ids]] # Many2many command (6, 0, ids) sets the relation to these IDs

        line_payload = {
            "name": line.description or "Line Item",
            "quantity": float(line.quantity or 1.0),
            "price_unit": float(line.unit_price or 0.0),
        }
        if line_tax_ids:
            line_payload["tax_ids"] = line_tax_ids
            
        invoice_lines.append((0, 0, line_payload))

    # Base payload
    payload = {
        "move_type": "in_invoice",
        "partner_id": partner_id,
        "ref": invoice.invoice_number,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "invoice_line_ids": invoice_lines,
    }
    return payload
