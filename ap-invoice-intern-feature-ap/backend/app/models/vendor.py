"""Vendor database model."""
from sqlalchemy import Column, Integer, String, Uuid, ForeignKey
from app.core.database import Base

class Vendor(Base):
    """Database schema mapping to the 'vendors' table."""
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    bank_account_number = Column(String, nullable=True)
    ifsc_code = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    organization_id = Column(Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
