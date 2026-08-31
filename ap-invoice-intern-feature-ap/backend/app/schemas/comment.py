from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class CommentCreate(BaseModel):
    text: str

class CommentResponse(BaseModel):
    id: int
    invoice_id: int
    user_id: UUID
    user_name: str
    user_role: str
    text: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
