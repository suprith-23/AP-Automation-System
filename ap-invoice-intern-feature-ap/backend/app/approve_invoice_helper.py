import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.invoice import Invoice

db = SessionLocal()
try:
    inv = db.query(Invoice).filter(Invoice.id == 7).first()
    if inv:
        print(f"ID: {inv.id}")
        print(f"Number: {inv.invoice_number}")
        print(f"Workflow Status: {inv.workflow_status}")
        print(f"Seller: {inv.seller_name}")
        print(f"Total: {inv.total_invoice_value}")
        print(f"Taxable: {inv.total_taxable_value}")
        print(f"CGST: {inv.total_cgst_value}")
        print(f"SGST: {inv.total_sgst_value}")
        print(f"IGST: {inv.total_igst_value}")
        print(f"Validation errors: {inv.validation_errors}")
        print(f"Match status: {inv.match_status}")
    else:
        print("Invoice 7 not found.")
finally:
    db.close()
