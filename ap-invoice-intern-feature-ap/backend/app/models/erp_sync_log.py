from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Uuid
from app.core.database import Base

class ERPSyncLog(Base):
    __tablename__ = "erp_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Uuid, nullable=True, index=True)
    erp_system = Column(String, nullable=False, index=True)      # "odoo", "netsuite", "sap", etc.
    sync_status = Column(String, nullable=False, index=True)    # "SUCCESS", "FAILED"
    sync_timestamp = Column(DateTime, default=datetime.utcnow)
    external_ref = Column(String, nullable=True)                 # Odoo Bill ID, SAP ID, etc.
    error_message = Column(String, nullable=True)
