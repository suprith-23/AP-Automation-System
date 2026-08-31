import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Uuid, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.organization import Organization

class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    designation = Column(String, default="Staff", nullable=False)
    status = Column(String, default="Active", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Employee self-registration and tenant isolation fields
    employee_id = Column(String, nullable=True)
    department = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    organization_id = Column(Uuid, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id])
    
    # Brute-force protection lockout columns
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    
    # Must change password on first login or manual admin reset
    must_change_password = Column(Boolean, default=False, nullable=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)



