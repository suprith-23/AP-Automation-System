"""Bootstrap initialization for seeding default Super Admin user."""
import os
import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security.hashing import hash_password

logger = logging.getLogger("app.bootstrap")

def bootstrap_superadmin():
    """Initializes the default Super Admin user if not already present."""
    email = os.getenv("INITIAL_SUPERADMIN_EMAIL", "nithin.super@company.com")
    password = os.getenv("INITIAL_SUPERADMIN_PASSWORD", "Password123!")
    
    db: Session = SessionLocal()
    try:
        super_admin = db.query(User).filter(User.email == email).first()
        if not super_admin:
            logger.info(f"Bootstrapping Super Admin user with email: {email}")
            hashed = hash_password(password)
            super_admin = User(
                name="Global Super Admin",
                email=email,
                password_hash=hashed,
                role="Super Admin",
                designation="Global Administrator",
                status="Active",
                is_active=True,
                employee_id="SA001"
            )
            db.add(super_admin)
            db.commit()
            logger.info("Successfully bootstrapped default Super Admin.")
        else:
            # Sync password if it has changed in environment variables
            # Or just keep it as is.
            pass
    except Exception as e:
        logger.error(f"Error bootstrapping Super Admin: {e}")
        db.rollback()
    finally:
        db.close()
