from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class TDSRuleBase(BaseModel):
    section_code: str
    description: Optional[str] = None
    rate_with_pan: float
    rate_without_pan: float = 20.0
    single_threshold: float = 30000.0
    aggregate_threshold: float = 100000.0
    vendor_categories: Optional[List[str]] = None
    expense_categories: Optional[List[str]] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None

class TDSRuleCreate(TDSRuleBase):
    pass

class TDSRuleUpdate(BaseModel):
    section_code: Optional[str] = None
    description: Optional[str] = None
    rate_with_pan: Optional[float] = None
    rate_without_pan: Optional[float] = None
    single_threshold: Optional[float] = None
    aggregate_threshold: Optional[float] = None
    vendor_categories: Optional[List[str]] = None
    expense_categories: Optional[List[str]] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None

class TDSRuleResponse(BaseModel):
    id: int
    organization_id: Optional[str] = None
    section_code: str
    description: Optional[str] = None
    rate_with_pan: float
    rate_without_pan: float
    single_threshold: float
    aggregate_threshold: float
    vendor_categories: Optional[List[str]] = None
    expense_categories: Optional[List[str]] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
