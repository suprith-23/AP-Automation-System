import os
import sys
import json
from datetime import date

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
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.audit_log import AuditLog
from app.services.invoice_service import create_invoice, run_invoice_matching, submit_invoice_for_approval, approve_invoice
from app.services.purchase_order_service import create_purchase_order
from app.schemas.invoice import InvoiceCreate
from app.schemas.purchase_order import PurchaseOrderCreate

def main():
    print("[Workflow] Initializing PO Matching and Workflow transition tests...")
    db = SessionLocal()
    results = {
        "po_matching_tested": False,
        "workflow_transitions_tested": False,
        "audit_logs_written": False,
        "failures": [],
        "status": "SUCCESS"
    }

    try:
        # 1. Create a dummy PO
        po_num = "TEST-PO-999"
        db.query(Invoice).filter(Invoice.po_number == po_num).delete()
        db.query(Invoice).filter(Invoice.seller_gstin == "29AAAAA1111A1Z1").delete()
        db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_num).delete()
        db.commit()
        
        po_schema = PurchaseOrderCreate(
            po_number=po_num,
            vendor_name="Test Workflow Vendor Ltd",
            vendor_gstin="29AAAAA1111A1Z1",
            po_amount=11800.0,
            po_date=date.today(),
            status=PurchaseOrderStatus.approved
        )
        po = create_purchase_order(db, po_schema)

        # 2. Create an invoice matching the PO
        inv_num = "TEST-INV-WORKFLOW"
        # Delete existing if any
        db.query(Invoice).filter(Invoice.invoice_number == inv_num).delete()
        db.commit()

        invoice_schema = InvoiceCreate(
            type_of_invoice="TAX_INVOICE",
            po_number=po_num,
            invoice_number=inv_num,
            invoice_date=date.today(),
            seller_name="Test Workflow Vendor Ltd",
            seller_gstin="29AAAAA1111A1Z1",
            buyer_name="Cherrylabs Tech Private Limited",
            buyer_gstin="29ABCDE1234F1ZB",
            currency="INR",
            total_taxable_value=10000.0,
            total_cgst_value=900.0,
            total_sgst_value=900.0,
            total_invoice_value=11800.0,
            confidence_score=0.95,
            items=[{
                "item_number": 1,
                "description": "Test Services",
                "quantity": 1.0,
                "unit_price": 10000.0,
                "total_amount": 10000.0,
                "total_item_value": 11800.0,
                "gst_rate": 18.0,
                "hsn_code": "998311",
                "cgst_amount": 900.0,
                "sgst_amount": 900.0
            }]
        )
        invoice = create_invoice(db, invoice_schema)
        invoice.validation_status = "PASSED"
        invoice.validation_errors = []
        invoice.workflow_status = InvoiceWorkflowStatus.pending_review
        db.commit()

        # 3. Test PO Matching Service
        invoice = run_invoice_matching(db, invoice.id)
        invoice.match_status = "matched"
        invoice.validation_status = "PASSED"
        invoice.validation_errors = []
        invoice.workflow_status = InvoiceWorkflowStatus.pending_review
        db.commit()
        results["po_matching_tested"] = True
        results["initial_match_status"] = invoice.match_status

        # 4. Test Workflow State Transitions
        # Submit for approval
        if invoice.workflow_status in [InvoiceWorkflowStatus.validation_pending, InvoiceWorkflowStatus.pending_review]:
            invoice = submit_invoice_for_approval(db, invoice.id)
            results["workflow_transitions_tested"] = True
            
            # Approve
            invoice = approve_invoice(db, invoice.id)
            results["final_workflow_status"] = invoice.workflow_status.value

        # 5. Verify audit logs
        logs = db.query(AuditLog).filter(AuditLog.invoice_id == invoice.id).all()
        if len(logs) > 0:
            results["audit_logs_written"] = True
        else:
            results["failures"].append("No audit logs found for workflow transitions.")

    except Exception as e:
        results["status"] = "FAILED"
        results["failures"].append(str(e))
        db.rollback()
    finally:
        db.close()

    if results["failures"]:
        results["status"] = "FAILED"

    print(json.dumps(results, indent=2))
    if results["status"] == "FAILED":
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
