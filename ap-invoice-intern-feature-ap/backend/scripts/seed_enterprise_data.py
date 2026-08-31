import os
import sys
import random
from datetime import datetime, date, timedelta
from sqlalchemy import text

# Setup path to import app packages
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from dotenv import load_dotenv
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env.local"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(BASE_DIR, 'test.db')}"
    os.environ["TESTING"] = "True"

from app.core.database import SessionLocal
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.hsn_master import HSNMaster
from app.models.audit_log import AuditLog
from app.services.invoice_service import create_invoice, submit_invoice_for_approval, approve_invoice, reject_invoice
from app.services.purchase_order_service import create_purchase_order
from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate
from app.schemas.purchase_order import PurchaseOrderCreate

VENDOR_NAMES = [
    "Apex Tech Instruments", "Acme Industrial Supplies", "Triveni Electricals",
    "Sigma Software Solutions", "Vertex Trading Corp", "Matrix Office Products",
    "Horizon Logistics", "Supreme Chemical Industries", "Zenith Consulting Services",
    "Prestige Packaging", "Bharat Petroleum Corp", "Tata Consultancy Services",
    "Reliance Industries", "Infosys Technologies", "Larsen & Tourbo",
    "Adani Power", "Wipro Limited", "HDFC Bank", "ICICI Bank", "State Bank of India"
]

BUYER = {
    "name": "Cherrylabs Tech Private Limited",
    "gstin": "29ABCDE1234F1ZB",
    "address": "No 45, 2nd Floor, Cherrylabs Lane, Bangalore, KA - 560001"
}

HSN_CODES = [
    {"code": "84713010", "rate": 18.0, "desc": "Laptops & computers"},
    {"code": "85285200", "rate": 18.0, "desc": "Monitors & screens"},
    {"code": "99831100", "rate": 18.0, "desc": "Consulting services"},
    {"code": "48025610", "rate": 12.0, "desc": "A4 papers"},
    {"code": "94033000", "rate": 18.0, "desc": "Office furniture"},
    {"code": "85444920", "rate": 28.0, "desc": "Cables & wires"}
]

def generate_vendors():
    vendors = []
    for i in range(160):
        name = f"{random.choice(VENDOR_NAMES)} Ltd {i+1}"
        state_code = f"{random.randint(1, 35):02d}"
        if state_code == "25": state_code = "24" # avoid invalid codes
        gstin = f"{state_code}AAAAA{random.randint(1000, 9999)}A{random.randint(1, 9)}Z{random.randint(0, 9)}"
        vendors.append({
            "name": name,
            "gstin": gstin,
            "address": f"Plot {i+100}, Sector {i%10 + 1}, Industrial Estate, India"
        })
    return vendors

def seed_hsn(db):
    for h in HSN_CODES:
        existing = db.query(HSNMaster).filter(HSNMaster.hsn_code == h["code"]).first()
        if not existing:
            cgst = h["rate"] / 2.0
            sgst = h["rate"] / 2.0
            hsn = HSNMaster(
                hsn_code=h["code"],
                description=h["desc"],
                tax_rate=h["rate"],
                cgst_rate=cgst,
                sgst_rate=sgst,
                igst_rate=h["rate"]
            )
            db.add(hsn)
    db.commit()

def clear_db(db):
    print("[Seed] Truncating existing tables...")
    tables = ["audit_logs", "invoice_items", "invoices", "purchase_orders", "hsn_master"]
    for table in tables:
        try:
            db.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
        except Exception:
            try:
                db.execute(text(f"DELETE FROM {table};"))
            except Exception as e:
                print(f"[Seed] Error clearing {table}: {e}")
    db.commit()

def main():
    db = SessionLocal()
    try:
        from app.models.organization import Organization
        org = db.query(Organization).filter(Organization.code == "beverly").first()
        org_id = org.id if org else None

        clear_db(db)
        seed_hsn(db)

        vendors = generate_vendors()
        print(f"[Seed] Generated {len(vendors)} unique vendor profiles.")

        print("[Seed] Seeding 320 Purchase Orders...")
        created_pos = []
        for i in range(320):
            vendor = vendors[i % len(vendors)]
            po_number = f"PO-2026-{10000 + i}"
            amount = round(random.uniform(5000.0, 150000.0), 2)
            po_date = date.today() - timedelta(days=random.randint(10, 60))
            status = random.choice([PurchaseOrderStatus.open, PurchaseOrderStatus.approved])
            
            po_schema = PurchaseOrderCreate(
                po_number=po_number,
                vendor_name=vendor["name"],
                vendor_gstin=vendor["gstin"],
                po_amount=amount,
                po_date=po_date,
                status=status
            )
            try:
                db_po = create_purchase_order(db, po_schema, organization_id=org_id)
                created_pos.append(db_po)
            except Exception as e:
                print(f"[Seed] Error PO {po_number}: {e}")
                db.rollback()

        print(f"[Seed] Successfully seeded {len(created_pos)} POs.")
        print("[Seed] Seeding 1020 Invoices...")
        
        # Check if we need to repair statuses of existing invoices (to fix pre-existing skipped records)
        pending_passed_invoices = db.query(Invoice).filter(
            Invoice.workflow_status == InvoiceWorkflowStatus.pending_review,
            Invoice.validation_status.in_(["PASSED", "passed"])
        ).all()
        if pending_passed_invoices:
            print(f"[Seed] Repairing statuses of {len(pending_passed_invoices)} existing invoices...")
            for idx, inv in enumerate(pending_passed_invoices):
                # Distribute some to approved, some to rejected, and some to pending approval
                if idx % 3 == 0:
                    inv.workflow_status = InvoiceWorkflowStatus.approved
                    inv.status = "approved"
                elif idx % 3 == 1:
                    inv.workflow_status = InvoiceWorkflowStatus.rejected
                    inv.status = "rejected"
                else:
                    inv.workflow_status = InvoiceWorkflowStatus.pending_approval
                    inv.status = "pending_approval"
            db.commit()
            print("[Seed] Successfully repaired existing invoice statuses.")

        invoice_count = 0
        hsn_list = HSN_CODES
        first_invoice_num = "INV-2026-99999"
        first_vendor = vendors[0]

        for i in range(1020):
            vendor = vendors[i % len(vendors)]
            invoice_num = f"INV-2026-{50000 + i}"
            invoice_date_val = date.today() - timedelta(days=random.randint(0, 30))
            due_date_val = invoice_date_val + timedelta(days=30)
            po = created_pos[i % len(created_pos)]
            po_num = po.po_number

            case_type = i % 10
            items = []
            num_items = random.randint(1, 3)
            subtotal = 0.0
            cgst_val = 0.0
            sgst_val = 0.0
            igst_val = 0.0
            is_intra = vendor["gstin"][:2] == BUYER["gstin"][:2]

            for item_idx in range(num_items):
                item_data = random.choice(hsn_list)
                qty = float(random.randint(1, 5))
                price = round(random.uniform(500.0, 5000.0), 2)
                item_sub = qty * price
                
                item_cgst = 0.0
                item_sgst = 0.0
                item_igst = 0.0
                if is_intra:
                    item_cgst = round(item_sub * (item_data["rate"] / 2) / 100, 2)
                    item_sgst = round(item_sub * (item_data["rate"] / 2) / 100, 2)
                    cgst_val += item_cgst
                    sgst_val += item_sgst
                else:
                    item_igst = round(item_sub * item_data["rate"] / 100, 2)
                    igst_val += item_igst
                
                subtotal += item_sub
                items.append(InvoiceItemCreate(
                    item_number=item_idx + 1,
                    description=item_data["desc"],
                    quantity=qty,
                    unit_price=price,
                    total_item_value=item_sub + item_cgst + item_sgst + item_igst,
                    hsn_code=item_data["code"],
                    gst_rate=item_data["rate"],
                    assessable_value=item_sub,
                    cgst_amount=item_cgst,
                    sgst_amount=item_sgst,
                    igst_amount=item_igst
                ))

            total_tax = cgst_val + sgst_val + igst_val
            total_invoice_val = subtotal + total_tax
            confidence = 0.95
            type_of_inv = "TAX_INVOICE"

            if case_type == 0:
                po_num = po.po_number
                total_invoice_val = po.po_amount
                subtotal = round(total_invoice_val / 1.18, 2)
                cgst_val = round((total_invoice_val - subtotal) / 2, 2)
                sgst_val = cgst_val
                items = [InvoiceItemCreate(
                    item_number=1, description="Laptops", quantity=1, unit_price=subtotal,
                    total_item_value=total_invoice_val, hsn_code="84713010", gst_rate=18.0,
                    assessable_value=subtotal, cgst_amount=cgst_val, sgst_amount=sgst_val
                )]
            elif case_type == 1:
                total_invoice_val = round(po.po_amount * 1.01, 2)
            elif case_type == 2:
                total_invoice_val = round(po.po_amount * 1.10, 2)
            elif case_type == 3:
                po_num = None
            elif case_type == 4:
                due_date_val = invoice_date_val - timedelta(days=5)
            elif case_type == 5:
                vendor_gstin = ""
            elif case_type == 6:
                confidence = 0.25
            elif case_type == 8:
                items[0].hsn_code = "99999999"
            elif case_type == 9:
                if is_intra:
                    igst_val = cgst_val + sgst_val
                    cgst_val = 0.0
                    sgst_val = 0.0
                    for item in items:
                        item.igst_amount = item.cgst_amount + item.sgst_amount
                        item.cgst_amount = 0.0
                        item.sgst_amount = 0.0

            invoice_schema = InvoiceCreate(
                type_of_invoice=type_of_inv,
                po_number=po_num,
                invoice_number=invoice_num if i > 0 else first_invoice_num,
                invoice_date=invoice_date_val,
                seller_name=vendor["name"],
                seller_gstin=vendor["gstin"] if case_type != 5 else None,
                buyer_name=BUYER["name"],
                buyer_gstin=BUYER["gstin"],
                shipping_name=BUYER["name"],
                shipping_gstin=BUYER["gstin"],
                total_taxable_value=subtotal,
                total_cgst_value=cgst_val,
                total_sgst_value=sgst_val,
                total_igst_value=igst_val,
                total_invoice_value=total_invoice_val,
                confidence_score=confidence,
                items=items,
                due_date=due_date_val,
                currency="INR"
            )

            try:
                db_invoice = create_invoice(db, invoice_schema, organization_id=org_id)
                invoice_count += 1
                
                # Directly set status properties to bypass service-level validation restrictions during seeding
                if i % 3 == 0:
                    db_invoice.workflow_status = InvoiceWorkflowStatus.approved
                    db_invoice.status = "approved"
                elif i % 3 == 1:
                    db_invoice.workflow_status = InvoiceWorkflowStatus.rejected
                    db_invoice.status = "rejected"
                else:
                    db_invoice.workflow_status = InvoiceWorkflowStatus.pending_approval
                    db_invoice.status = "pending_approval"
                
                db.commit()
            except Exception as e:
                db.rollback()

        print(f"[Seed] Successfully seeded {invoice_count} invoices in DB.")
        print(f"STATUS=SUCCESS")
    except Exception as e:
        print(f"STATUS=FAILED error={str(e)}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
