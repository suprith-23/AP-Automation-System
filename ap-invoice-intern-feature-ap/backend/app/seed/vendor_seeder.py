"""Vendor auto-seeding logic."""
import logging
from sqlalchemy.orm import Session
from app.models.vendor import Vendor
from app.models.organization import Organization

logger = logging.getLogger(__name__)

VENDORS_SEED_DATA = [
    {"name": "D-Mart Retail Ltd", "bank_name": "State Bank of India", "bank_account_number": "110022334455", "ifsc_code": "SBIN0000123"},
    {"name": "Reliance Industries Ltd", "bank_name": "HDFC Bank", "bank_account_number": "50100223344556", "ifsc_code": "HDFC0000001"},
    {"name": "Tata Consultancy Services", "bank_name": "ICICI Bank", "bank_account_number": "000401223344", "ifsc_code": "ICIC0000004"},
    {"name": "Infosys Technologies", "bank_name": "Axis Bank", "bank_account_number": "912010022334455", "ifsc_code": "UTIB0000009"},
    {"name": "Wipro Enterprises", "bank_name": "Canara Bank", "bank_account_number": "040110122334", "ifsc_code": "CNRB0000401"},
    {"name": "Airtel India Ltd", "bank_name": "IndusInd Bank", "bank_account_number": "201001223344", "ifsc_code": "INDB0000001"},
    {"name": "Adani Power", "bank_name": "Bank of Baroda", "bank_account_number": "01020304050607", "ifsc_code": "BARB0BOMBAY"},
    {"name": "Mahindra & Mahindra", "bank_name": "Kotak Mahindra Bank", "bank_account_number": "123456789012", "ifsc_code": "KKBK0000123"},
    {"name": "Larsen & Toubro Ltd", "bank_name": "Punjab National Bank", "bank_account_number": "00112233445566", "ifsc_code": "PUNB0000011"},
    {"name": "ITC Limited", "bank_name": "Standard Chartered Bank", "bank_account_number": "33445566778", "ifsc_code": "SCBL0036001"},
    {"name": "Hindustan Unilever", "bank_name": "Yes Bank", "bank_account_number": "098765432109", "ifsc_code": "YESB0000001"},
    {"name": "Asian Paints Ltd", "bank_name": "Union Bank of India", "bank_account_number": "55667788990011", "ifsc_code": "UBIN0531234"},
    {"name": "Bajaj Auto", "bank_name": "IDBI Bank", "bank_account_number": "01234567890123", "ifsc_code": "IBKL0000001"},
    {"name": "Maruti Suzuki Ltd", "bank_name": "Federal Bank", "bank_account_number": "10020030040050", "ifsc_code": "FDRL0001002"},
    {"name": "Gail India", "bank_name": "Indian Overseas Bank", "bank_account_number": "02010203040506", "ifsc_code": "IOBA0000201"},
]

def seed_vendors(db: Session):
    """Seed vendors list for all organizations if empty."""
    try:
        orgs = db.query(Organization).all()
        if not orgs:
            logger.warning("No organizations found; skipping vendor seeding.")
            return

        for org in orgs:
            existing_count = db.query(Vendor).filter(Vendor.organization_id == org.id).count()
            if existing_count < len(VENDORS_SEED_DATA):
                logger.info(f"Seeding {len(VENDORS_SEED_DATA)} vendors for organization {org.name}...")
                for v_data in VENDORS_SEED_DATA:
                    # Check if vendor already exists by name for this org
                    existing = db.query(Vendor).filter(
                        Vendor.name == v_data["name"],
                        Vendor.organization_id == org.id
                    ).first()
                    if not existing:
                        vendor = Vendor(
                            name=v_data["name"],
                            bank_name=v_data["bank_name"],
                            bank_account_number=v_data["bank_account_number"],
                            ifsc_code=v_data["ifsc_code"],
                            organization_id=org.id
                        )
                        db.add(vendor)
                db.commit()
                logger.info(f"Successfully seeded vendors for {org.name}.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding vendors: {e}")
