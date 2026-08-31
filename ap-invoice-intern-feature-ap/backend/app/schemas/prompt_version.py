from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class PromptVersionBase(BaseModel):
    version: str
    content: str
    notes: Optional[str] = None
    author: Optional[str] = "Admin"
    is_active: Optional[bool] = False

class PromptVersionCreate(PromptVersionBase):
    pass

class PromptVersionUpdate(BaseModel):
    content: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class PromptVersionResponse(PromptVersionBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PromptTestRequest(BaseModel):
    prompt_content: str
    sample_ocr_text: Optional[str] = None

class PromptTestResponse(BaseModel):
    extracted_json: dict
    raw_response: str
    success: bool
    error: Optional[str] = None
