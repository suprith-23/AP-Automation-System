import os
from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.invoice import Invoice
from app.models.organization import Organization
from app.models.user import User

def check():
    db = SessionLocal()
    try:
        from app.models.audit_log import AuditLog
        from app.core.database import set_tenant_context
        set_tenant_context(db, "BYPASS_RLS_SUPERADMIN")
        
        print("--- LATEST INVOICES ---")
        invoices = db.query(Invoice).order_by(Invoice.id.desc()).all()
        for inv in invoices[:5]:
            print(f"ID: {inv.id} | No: {inv.invoice_number} | Status: {inv.workflow_status} | Val: {inv.validation_status} | Errs: {inv.validation_errors}")

        print("\n--- LATEST 20 AUDIT LOGS ---")
        logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()
        for log in logs[:20]:
            print(f"{log.timestamp} | {log.action} | {log.performed_by} | {log.status_before} -> {log.status_after} | details: {log.details}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
