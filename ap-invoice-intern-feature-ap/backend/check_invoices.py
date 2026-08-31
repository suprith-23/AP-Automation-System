from app.core.database import SessionLocal
from app.models.invoice import Invoice
from app.models.organization import Organization

def check_invoices():
    db = SessionLocal()
    try:
        print("--- Invoices Diagnostic Check ---")
        invoices = db.query(Invoice).all()
        print(f"Total Invoices in Database: {len(invoices)}")
        
        if len(invoices) > 0:
            print("\nFirst 5 Invoices details:")
            for inv in invoices[:5]:
                # Fetch org name if organization_id exists
                org_name = "None (No Organization)"
                if inv.organization_id:
                    org = db.query(Organization).filter(Organization.id == inv.organization_id).first()
                    if org:
                        org_name = f"{org.name} (Code: {org.code})"
                
                print(f" - Invoice Number: {inv.invoice_number} | Vendor: {inv.seller_name or inv.vendor_name} | Amount: {inv.total_amount} | Org: {org_name}")
        else:
            print("\nNo invoices found in the database. The database is empty.")
            
    except Exception as e:
        print(f"Error checking invoices: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_invoices()
