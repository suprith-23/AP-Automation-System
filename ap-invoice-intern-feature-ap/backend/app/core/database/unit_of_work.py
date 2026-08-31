import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal

logger = logging.getLogger("ap_automation.unit_of_work")

class UnitOfWork:
    """
    Manages database sessions and commit/rollback transactions as a single unit.
    Helps isolate SQLAlchemy from service layer signatures.
    """
    def __init__(self):
        self.session: Session = None

    def __enter__(self):
        self.session = SessionLocal()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            logger.error(f"UoW rolling back due to exception: {exc_val}")
            self.session.rollback()
        else:
            try:
                self.session.commit()
            except Exception as e:
                logger.error(f"UoW commit failure: {e}")
                self.session.rollback()
                raise e
        self.session.close()
