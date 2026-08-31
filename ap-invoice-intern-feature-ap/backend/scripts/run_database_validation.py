import os
import sys
import json
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

# Setup path to import app packages
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from dotenv import load_dotenv
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env.local"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(BASE_DIR, 'test.db')}"

from app.core.database import SessionLocal
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder
from app.models.audit_log import AuditLog
from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate

def test_transaction_rollback(db):
    print("[Database] Testing transaction rollback behavior...")
    # 1. Count invoices
    initial_count = db.query(Invoice).count()

    # 2. Begin nested transaction/savepoint or simple transactional try-block
    db.begin_nested()
    try:
        # Create a temp invoice item with invalid parent id to trigger IntegrityError
        item = InvoiceItem(
            invoice_id=999999,  # Non-existent invoice ID
            item_number=1,
            description="Rollback test item",
            quantity=1,
            unit_price=10.0,
            total_item_value=10.0
        )
        db.add(item)
        db.commit()  # Should fail here or on flush
    except Exception as e:
        db.rollback()
        print(f"[Database] Success: Rollback triggered successfully: {str(e)[:60]}")

    post_count = db.query(Invoice).count()
    return initial_count == post_count

def test_cascade_delete(db):
    print("[Database] Testing cascade delete constraint...")
    # 1. Create temporary invoice
    import random
    from datetime import date
    test_num = f"TEMP-INV-{random.randint(100000, 999999)}"
    inv = Invoice(
        invoice_number=test_num,
        seller_name="Cascade Test Vendor",
        seller_gstin="29AAAAA0000A1Z1",
        buyer_name="Cherrylabs Tech Private Limited",
        buyer_gstin="29ABCDE1234F1ZB",
        total_invoice_value=100.0,
        total_taxable_value=100.0,
        workflow_status=InvoiceWorkflowStatus.validation_pending,
        invoice_date=date.today(),
        currency="INR"
    )
    db.add(inv)
    db.flush()  # gets inv.id

    # 2. Add an invoice item referencing it
    item = InvoiceItem(
        invoice_id=inv.id,
        item_number=1,
        description="Temp item",
        quantity=1,
        unit_price=100.0,
        total_item_value=100.0
    )
    db.add(item)
    db.commit()

    item_id = item.id

    # Verify item exists
    assert db.query(InvoiceItem).filter(InvoiceItem.id == item_id).first() is not None

    # 3. Delete parent invoice
    db.delete(inv)
    db.commit()

    # 4. Verify item is cascaded deleted
    cascaded_item = db.query(InvoiceItem).filter(InvoiceItem.id == item_id).first()
    return cascaded_item is None

def main():
    db = SessionLocal()
    results = {
        "rollback_passed": False,
        "cascade_passed": False,
        "constraints_verified": False,
        "status": "SUCCESS"
    }

    try:
        results["rollback_passed"] = test_transaction_rollback(db)
        results["cascade_passed"] = test_cascade_delete(db)
        results["constraints_verified"] = results["rollback_passed"] and results["cascade_passed"]
    except Exception as e:
        results["status"] = "FAILED"
        results["error"] = str(e)
    finally:
        db.close()

    if not results["constraints_verified"]:
        results["status"] = "FAILED"

    print(json.dumps(results, indent=2))
    if results["status"] == "FAILED":
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
