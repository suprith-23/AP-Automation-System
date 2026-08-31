"""Database model for the HSN Master records."""
from sqlalchemy import Column, Integer, String, Float, Text
from app.core.database import Base

class HSNMaster(Base):
    """
    SQLAlchemy model representing the master database of HSN (Harmonized System of Nomenclature) codes.
    """
    __tablename__ = "hsn_master"
    
    # Primary key identifier
    id = Column(Integer, primary_key=True, index=True)
    
    # HSN Code - indexed and unique for fast queries
    hsn_code = Column(String(8), unique=True, index=True, nullable=False)
    
    # Text description of the goods or services (expanded to Text type)
    description = Column(Text, nullable=True)
    
    # Standard tax rate corresponding to the HSN code
    tax_rate = Column(Float, nullable=True)
    
    # Sub-rate metadata columns
    cgst_rate = Column(Float, nullable=True)
    sgst_rate = Column(Float, nullable=True)
    igst_rate = Column(Float, nullable=True)


