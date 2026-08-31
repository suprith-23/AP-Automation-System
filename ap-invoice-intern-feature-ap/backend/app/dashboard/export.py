"""Export serialization logic for CSV, Excel HTML, and JSON formats."""
import csv
import json
import io
from typing import List
from app.models.invoice import Invoice

def serialize_to_csv(invoices: List[Invoice]) -> str:
    """Serializes a list of invoices into CSV format."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "invoice_number", "vendor_name", "invoice_date", "total_amount", "status", "workflow_status"])
    for inv in invoices:
        writer.writerow([
            inv.id,
            inv.invoice_number or "",
            inv.vendor_name or inv.seller_name or "",
            inv.invoice_date or "",
            inv.total_invoice_value or inv.total_amount or 0.0,
            inv.status or "",
            inv.workflow_status.value if inv.workflow_status else ""
        ])
    return output.getvalue()

def serialize_to_json(invoices: List[Invoice]) -> str:
    """Serializes a list of invoices into JSON format."""
    data = []
    for inv in invoices:
        data.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "vendor_name": inv.vendor_name or inv.seller_name,
            "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
            "total_amount": inv.total_invoice_value or inv.total_amount,
            "status": inv.status,
            "workflow_status": inv.workflow_status.value if inv.workflow_status else None
        })
    return json.dumps(data, indent=2)

def serialize_to_excel_html(invoices: List[Invoice]) -> str:
    """Serializes a list of invoices into an HTML spreadsheet that Excel parses natively."""
    html = """<html>
<head><meta http-equiv="content-type" content="text/html; charset=UTF-8"></head>
<body>
<table border="1">
    <tr bgcolor="#f2f2f2">
        <th>ID</th>
        <th>Invoice Number</th>
        <th>Vendor Name</th>
        <th>Invoice Date</th>
        <th>Total Amount</th>
        <th>Status</th>
        <th>Workflow Status</th>
    </tr>"""
    for inv in invoices:
        html += f"""
    <tr>
        <td>{inv.id}</td>
        <td>{inv.invoice_number or ''}</td>
        <td>{inv.vendor_name or inv.seller_name or ''}</td>
        <td>{inv.invoice_date or ''}</td>
        <td>{inv.total_invoice_value or inv.total_amount or 0.0:.2f}</td>
        <td>{inv.status or ''}</td>
        <td>{inv.workflow_status.value if inv.workflow_status else ''}</td>
    </tr>"""
    html += """
</table>
</body>
</html>"""
    return html
