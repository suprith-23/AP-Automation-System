from app.core.database import SessionLocal
from app.models.user import User
from app.api.user_routes import get_user_stats
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem

db = SessionLocal()
# Find an admin user
admin = db.query(User).filter(User.role == "Admin").first()
print("Using admin user:", admin.name, admin.email)

try:
    res = get_user_stats(db=db, current_user=admin)
    print("Response data type:", type(res))
    print("Stats items count:", len(res))
    if len(res) > 0:
        print("First item stats:", res[0])
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
