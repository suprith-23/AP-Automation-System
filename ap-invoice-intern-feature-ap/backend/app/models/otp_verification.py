import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Uuid, Integer, Boolean
from app.core.database import Base

class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, index=True, nullable=False)
    otp_code = Column(String, nullable=False)
    action = Column(String, nullable=False)  # "REGISTRATION", "FORGOT_PASSWORD", "CHANGE_PASSWORD", "CHANGE_EMAIL"
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
