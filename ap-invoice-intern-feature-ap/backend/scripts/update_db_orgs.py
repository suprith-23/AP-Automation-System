import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from dotenv import load_dotenv
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env.local"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

from app.core.database import SessionLocal
from app.models.invoice import Invoice
from app.models.purchase_order import PurchaseOrder
from app.models.organization import Organization

def update_db():
    db = SessionLocal()
    try:
        # Get organizations
        beverly = db.query(Organization).filter(Organization.code == "beverly").first()
        global_org = db.query(Organization).filter(Organization.code == "global").first()
        innovate = db.query(Organization).filter(Organization.code == "innovate").first()

        if not beverly or not global_org:
            print("Organizations not found in database. Seed organizations first.")
            return

        print(f"Beverly ID: {beverly.id}")
        print(f"Global ID: {global_org.id}")

        # Update invoices
        # 1. TD01167104 invoices -> Beverly
        td_invoices = db.query(Invoice).filter(Invoice.invoice_number == "TD01167104").all()
        for inv in td_invoices:
            inv.organization_id = beverly.id
            inv.buyer_gstin = beverly.gst_number
            print(f"Assigned invoice {inv.id} ({inv.invoice_number}) to Beverly")

        # 2. INV-2026-001 -> Beverly
        inv1 = db.query(Invoice).filter(Invoice.invoice_number == "INV-2026-001").first()
        if inv1:
            inv1.organization_id = beverly.id
            inv1.buyer_gstin = beverly.gst_number
            print(f"Assigned invoice {inv1.id} ({inv1.invoice_number}) to Beverly")

        # 3. INV-2026-002 -> Beverly
        inv2 = db.query(Invoice).filter(Invoice.invoice_number == "INV-2026-002").first()
        if inv2:
            inv2.organization_id = beverly.id
            inv2.buyer_gstin = beverly.gst_number
            print(f"Assigned invoice {inv2.id} ({inv2.invoice_number}) to Beverly")

        # 4. INV-2026-003 -> Global
        inv3 = db.query(Invoice).filter(Invoice.invoice_number == "INV-2026-003").first()
        if inv3:
            inv3.organization_id = global_org.id
            inv3.buyer_gstin = global_org.gst_number
            print(f"Assigned invoice {inv3.id} ({inv3.invoice_number}) to Global")

        # Update POs
        # PO-2026-001 -> Beverly
        po1 = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == "PO-2026-001").first()
        if po1:
            po1.organization_id = beverly.id
            print(f"Assigned PO {po1.po_number} to Beverly")

        # PO-2026-002 -> Beverly
        po2 = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == "PO-2026-002").first()
        if po2:
            po2.organization_id = beverly.id
            print(f"Assigned PO {po2.po_number} to Beverly")

        # PO-2026-003 -> Global
        po3 = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == "PO-2026-003").first()
        if po3:
            po3.organization_id = global_org.id
            print(f"Assigned PO {po3.po_number} to Global")

        db.commit()
        print("Database updates completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error updating database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_db()
