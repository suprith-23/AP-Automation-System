from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID

class UserBase(BaseModel):
    name: str
    email: str
    role: str
    designation: str
    status: Optional[str] = "Active"
    is_active: Optional[bool] = True
    employee_id: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    organization_id: Optional[UUID] = None

class UserCreate(UserBase):
    password: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    must_change_password: bool

    model_config = ConfigDict(from_attributes=True)
