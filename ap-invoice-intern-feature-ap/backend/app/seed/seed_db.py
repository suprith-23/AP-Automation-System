"""Populate the database with local sample data."""

import os
import json
from datetime import date
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine, Base
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.hsn_master import HSNMaster
from app.models.user import User
from app.models.organization import Organization

# Import all other models to ensure they are registered with Base metadata
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.job import Job
from app.models.otp_verification import OTPVerification
from app.models.settings import Settings
from app.models.prompt_version import PromptVersion
from app.models.tds import TDSSection, TDSLedgerEntry
from app.models.gst_hsn_rule import GSTHsnRule
from app.models.po_item import PurchaseOrderItem, GRN, GRNItem
from app.models.approval import ApprovalRule, ApprovalRequest, ApprovalHistory
from app.models.payment import PaymentSchedule, PaymentTransaction, CreditDebitNote, PaymentGatewayConfig
from app.models.exception_record import InvoiceException
from app.models.ai_provider_config import AIProviderConfig
from app.models.failed_task import FailedTask
from app.models.erp_sync_log import ERPSyncLog
from app.models.vendor import Vendor
from app.models.comment import InvoiceComment
from app.workflow.models import (
    WorkflowInstance,
    WorkflowState,
    WorkflowHistory,
    WorkflowEvent,
    WorkflowApprovalRequest,
    WorkflowApprovalAction,
    SLARecord,
    EscalationRecord
)
from app.core.security.hashing import hash_password


def sa_float(val) -> float:
    """Safely convert value to float, defaulting to 0.0 if None."""
    return float(val) if val is not None else 0.0


def seed_database():
    """Load sample invoices and purchase orders if they are not already present."""
    print("Initializing database tables...")
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE;"))
        conn.execute(text("CREATE SCHEMA public;"))
        conn.commit()
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        # 1. Seed Organizations
        default_orgs = [
            {"name": "Beverly", "code": "beverly", "gst_number": "27AAAAA1111A1Z1"},
            {"name": "Global Industries", "code": "global", "gst_number": "27BBBBB2222B2Z2"},
            {"name": "Innovate LLC", "code": "innovate", "gst_number": "27CCCCC3333C3Z3"}
        ]
        
        org_map = {}
        for org_data in default_orgs:
            org = db.query(Organization).filter(Organization.code == org_data["code"]).first()
            if not org:
                org = Organization(
                    name=org_data["name"],
                    code=org_data["code"],
                    gst_number=org_data["gst_number"],
                    status="Active"
                )
                db.add(org)
                db.commit()
                db.refresh(org)
                print(f"Seeded organization: {org.name}")
            org_map[org_data["code"]] = org.id

        # 2. Seed default users
        default_users = [
            # Nithin: Global Super Admin
            {
                "name": "Nithin",
                "email": "nithin.super@company.com",
                "role": "Super Admin",
                "designation": "System Owner",
                "password": "Password123!",
                "org_code": None
            },
            # Beverly Users
            {
                "name": "Suprith",
                "email": "suprith@beverly.com",
                "role": "Admin",
                "designation": "AP Administrator",
                "password": "Password123!",
                "org_code": "beverly"
            },
            {
                "name": "Ranjitha",
                "email": "ranjitha@beverly.com",
                "role": "Reviewer",
                "designation": "AP Reviewer",
                "password": "Password123!",
                "org_code": "beverly"
            },
            {
                "name": "Pooja",
                "email": "pooja@beverly.com",
                "role": "Approver",
                "designation": "Finance Approver",
                "password": "Password123!",
                "org_code": "beverly"
            },
            {
                "name": "Tharun",
                "email": "tharun@beverly.com",
                "role": "Approver",
                "designation": "Finance Approver",
                "password": "Password123!",
                "org_code": "beverly"
            },
            {
                "name": "Beverly Auditor",
                "email": "auditor@beverly.com",
                "role": "Auditor",
                "designation": "Audit Lead",
                "password": "Password123!",
                "org_code": "beverly"
            },
            # Global Industries Demo Users
            {
                "name": "Global Admin",
                "email": "admin@global.com",
                "role": "Admin",
                "designation": "Global AP Admin",
                "password": "Password123!",
                "org_code": "global"
            },
            {
                "name": "Global Reviewer",
                "email": "reviewer@global.com",
                "role": "Reviewer",
                "designation": "Global AP Reviewer",
                "password": "Password123!",
                "org_code": "global"
            },
            # Innovate LLC Demo Users
            {
                "name": "Innovate Admin",
                "email": "admin@innovate.com",
                "role": "Admin",
                "designation": "Innovate AP Admin",
                "password": "Password123!",
                "org_code": "innovate"
            }
        ]

        for u_data in default_users:
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if not existing:
                org_id = org_map.get(u_data["org_code"]) if u_data["org_code"] else None
                user_obj = User(
                    name=u_data["name"],
                    email=u_data["email"],
                    role=u_data["role"],
                    designation=u_data["designation"],
                    status="Active",
                    password_hash=hash_password(u_data["password"]),
                    is_active=True,
                    organization_id=org_id
                )
                db.add(user_obj)
                print(f"Seeded user: {user_obj.email} ({user_obj.role})")
        db.commit()

        current_dir = os.path.dirname(os.path.abspath(__file__))

        # Load invoice samples first.
        invoices_file = os.path.join(current_dir, "dummy_invoices.json")
        if os.path.exists(invoices_file) and os.path.getsize(invoices_file) > 0:
            print(f"Loading invoices from {invoices_file}...")
            with open(invoices_file, "r") as f:
                invoices_data = json.load(f)
                
            for item in invoices_data:
                existing = db.query(Invoice).filter(Invoice.invoice_number == item["invoice_number"]).first()
                if not existing:
                    items_data = item.pop("items", None) or []
                    
                    # Determine organization for tenant isolation mapping
                    buyer_gst = item.get("buyer_gstin")
                    if buyer_gst and "BBBBB" in buyer_gst:
                        invoice_org_id = org_map.get("global")
                        buyer_gstin_val = "27BBBBB2222B2Z2"
                    elif buyer_gst and "CCCCC" in buyer_gst:
                        invoice_org_id = org_map.get("innovate")
                        buyer_gstin_val = "27CCCCC3333C3Z3"
                    else:
                        invoice_org_id = org_map.get("beverly")
                        buyer_gstin_val = "27AAAAA1111A1Z1" if item.get("invoice_number") != "TD01167104" else None

                    invoice_obj = Invoice(
                        type_of_invoice=item.get("type_of_invoice", "TAX_INVOICE"),
                        irn=item.get("irn", ""),
                        po_number=item.get("po_number"),
                        invoice_number=item["invoice_number"],
                        invoice_date=date.fromisoformat(item["invoice_date"]),
                        seller_name=item.get("seller_name"),
                        seller_gstin=item.get("seller_gstin"),
                        seller_gstin_pincode=item.get("seller_gstin_pincode", 0),
                        buyer_name=item.get("buyer_name"),
                        buyer_gstin=buyer_gstin_val,
                        buyer_gstin_pincode=item.get("buyer_gstin_pincode", 0),
                        shipping_name=item.get("shipping_name"),
                        shipping_gstin=item.get("shipping_gstin"),
                        shipping_gstin_pincode=item.get("shipping_gstin_pincode", 0),
                        total_taxable_value=sa_float(item.get("total_taxable_value")),
                        total_gst_rate=sa_float(item.get("total_gst_rate")),
                        total_cgst_value=sa_float(item.get("total_cgst_value")),
                        total_sgst_value=sa_float(item.get("total_sgst_value")),
                        total_igst_value=sa_float(item.get("total_igst_value")),
                        total_ces_value=sa_float(item.get("total_ces_value")),
                        total_st_ces_value=sa_float(item.get("total_st_ces_value")),
                        total_discount_value=sa_float(item.get("total_discount_value")),
                        round_off_amount=sa_float(item.get("round_off_amount")),
                        total_accessment_value=sa_float(item.get("total_accessment_value")),
                        total_invoice_value=sa_float(item.get("total_invoice_value")),
                        
                        # System workflow fields
                        workflow_status=InvoiceWorkflowStatus(item.get("workflow_status", "validation_pending")),
                        validation_status=item.get("validation_status", "pending"),
                        match_status=item.get("match_status", "pending"),
                        confidence_score=item.get("confidence_score"),
                        source_type=item.get("source_type", "json_api"),
                        confidence_json=item.get("confidence_json", {
                            "invoice_number": 0.98,
                            "invoice_date": 0.95,
                            "seller_gstin": 0.99,
                            "buyer_gstin": 0.99,
                            "total_amount": 0.97,
                            "po_number": 0.96,
                            "line_items": 0.92
                        }),
                        
                        # Backward compatibility fallback
                        vendor_name=item.get("vendor_name", item.get("seller_gstin")),
                        due_date=date.fromisoformat(item["due_date"]) if item.get("due_date") else None,
                        subtotal=sa_float(item.get("subtotal", item.get("total_taxable_value"))),
                        tax_amount=sa_float(item.get("tax_amount")),
                        total_amount=sa_float(item.get("total_amount", item.get("total_invoice_value"))),
                        currency=item.get("currency", "INR"),
                        status=item.get("status", item.get("match_status", "pending")),
                        organization_id=invoice_org_id
                    )
                    
                    db.add(invoice_obj)
                    db.commit()
                    db.refresh(invoice_obj)
                    
                    # Add child items
                    for it in items_data:
                        db_item = InvoiceItem(
                            invoice_id=invoice_obj.id,
                            item_number=it.get("item_number"),
                            sl_no=it.get("sl_no"),
                            is_service=it.get("is_service", "N"),
                            description=it.get("description"),
                            hsn_code=it.get("hsn_code"),
                            quantity=sa_float(it.get("quantity")),
                            unit=it.get("unit"),
                            unit_price=sa_float(it.get("unit_price")),
                            total_amount=sa_float(it.get("total_amount")),
                            discount=sa_float(it.get("discount")),
                            assessable_value=sa_float(it.get("assessable_value")),
                            gst_rate=sa_float(it.get("gst_rate")),
                            igst_amount=sa_float(it.get("igst_amount")),
                            cgst_amount=sa_float(it.get("cgst_amount")),
                            sgst_amount=sa_float(it.get("sgst_amount")),
                            cess_rate=sa_float(it.get("cess_rate")),
                            cess_amount=sa_float(it.get("cess_amount")),
                            cess_non_advalorem_amount=sa_float(it.get("cess_non_advalorem_amount")),
                            state_cess_rate=sa_float(it.get("state_cess_rate")),
                            state_cess_amount=sa_float(it.get("state_cess_amount")),
                            other_charges=sa_float(it.get("other_charges")),
                            total_item_value=sa_float(it.get("total_item_value"))
                        )
                        db.add(db_item)
                    db.commit()
                    print(f"Added invoice: {invoice_obj.invoice_number}")
                else:
                    print(f"Invoice {item['invoice_number']} already exists. Skipping.")
        else:
            print(f"Seed file empty or not found: {invoices_file}")

        # Load purchase order samples next.
        po_file = os.path.join(current_dir, "dummy_purchase_orders.json")
        if os.path.exists(po_file) and os.path.getsize(po_file) > 0:
            print(f"Loading purchase orders from {po_file}...")
            with open(po_file, "r") as f:
                po_data = json.load(f)
                
            for item in po_data:
                existing = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == item["po_number"]).first()
                if not existing:
                    # Match PO to org
                    po_number = item["po_number"]
                    if po_number in ("PO-2026-001", "PO-2026-002"):
                        po_org_id = org_map.get("beverly")
                    else:
                        po_org_id = org_map.get("global")

                    po_obj = PurchaseOrder(
                        po_number=item["po_number"],
                        vendor_name=item["vendor_name"],
                        vendor_gstin=item.get("vendor_gstin"),
                        po_amount=float(item["po_amount"]),
                        po_date=sa_float(item.get("po_date")) if isinstance(item.get("po_date"), (int, float)) else date.fromisoformat(item["po_date"]),
                        status=PurchaseOrderStatus(item["status"]),
                        organization_id=po_org_id
                    )
                    db.add(po_obj)
                    print(f"Added purchase order: {po_obj.po_number}")
                else:
                    print(f"Purchase order {item['po_number']} already exists. Skipping.")
        else:
            print(f"Seed file empty or not found: {po_file}")

        # Load HSN master samples next.
        hsn_file = os.path.join(current_dir, "dummy_hsn.json")
        if os.path.exists(hsn_file) and os.path.getsize(hsn_file) > 0:
            print(f"Loading HSN master codes from {hsn_file}...")
            with open(hsn_file, "r") as f:
                hsn_data = json.load(f)
                
            for item in hsn_data:
                existing = db.query(HSNMaster).filter(HSNMaster.hsn_code == item["hsn_code"]).first()
                if not existing:
                    hsn_obj = HSNMaster(
                        hsn_code=item["hsn_code"],
                        description=item.get("description"),
                        tax_rate=sa_float(item.get("tax_rate")),
                        cgst_rate=sa_float(item.get("cgst_rate")) if item.get("cgst_rate") is not None else None,
                        sgst_rate=sa_float(item.get("sgst_rate")) if item.get("sgst_rate") is not None else None,
                        igst_rate=sa_float(item.get("igst_rate")) if item.get("igst_rate") is not None else None
                    )
                    db.add(hsn_obj)
                    print(f"Added HSN master code: {hsn_obj.hsn_code}")
                else:
                    existing.description = item.get("description")
                    existing.tax_rate = sa_float(item.get("tax_rate"))
                    existing.cgst_rate = sa_float(item.get("cgst_rate")) if item.get("cgst_rate") is not None else None
                    existing.sgst_rate = sa_float(item.get("sgst_rate")) if item.get("sgst_rate") is not None else None
                    existing.igst_rate = sa_float(item.get("igst_rate")) if item.get("igst_rate") is not None else None
                    print(f"Updated HSN master code: {existing.hsn_code}")
        else:
            print(f"Seed file empty or not found: {hsn_file}")

        # Seed vendors list.
        from app.seed.vendor_seeder import seed_vendors
        seed_vendors(db)

        db.commit()
        print("Database seeding completed successfully.")

    except Exception as exc:
        db.rollback()
        print(f"Error during database seeding: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
