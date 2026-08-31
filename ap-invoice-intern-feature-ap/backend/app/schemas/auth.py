from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from uuid import UUID
from datetime import datetime

def validate_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(c.isupper() for c in v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not any(c.islower() for c in v):
        raise ValueError("Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one number")
    special_chars = "@$!%*?&"
    if not any(c in special_chars for c in v):
        raise ValueError(f"Password must contain at least one special character from {special_chars}")
    return v

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str
    confirm_password: str
    role: str = "Reviewer"
    designation: Optional[str] = "Staff"
    employee_id: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    organization_id: Optional[str] = None

    @validator('password')
    def check_password(cls, v):
        return validate_password_strength(v)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthUserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    designation: str
    status: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    must_change_password: bool

    class Config:
        orm_mode = True
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AuthUserResponse

class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str

    @validator('password')
    def check_password(cls, v):
        return validate_password_strength(v)

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    otp_code: Optional[str] = None

    @validator('new_password')
    def check_password(cls, v):
        return validate_password_strength(v)

class OTPSendRequest(BaseModel):
    email: EmailStr
    action: str

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    action: str
    otp_code: str

class RegisterPendingRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    role: str = "Reviewer"
    designation: Optional[str] = "Staff"
    employee_id: str = Field(..., min_length=1)
    department: Optional[str] = None
    phone: Optional[str] = None
    organization_id: str = Field(..., min_length=1)

class ResetPasswordOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str
    password: str
    confirm_password: str

    @validator('password')
    def check_password(cls, v):
        return validate_password_strength(v)

class SetPasswordOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str
    password: str
    confirm_password: str

    @validator('password')
    def check_password(cls, v):
        return validate_password_strength(v)

class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    otp_code: str



