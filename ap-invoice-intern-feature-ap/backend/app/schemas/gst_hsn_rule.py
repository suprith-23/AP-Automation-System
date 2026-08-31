"""Pydantic schemas for GSTHsnRule CRUD endpoints."""
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional


class GSTHsnRuleCreate(BaseModel):
    hsn_prefix: str
    rule_type: str  # "RCM" | "BLOCKED_ITC"

    @field_validator("rule_type")
    @classmethod
    def validate_rule_type(cls, v: str) -> str:
        allowed = {"RCM", "BLOCKED_ITC"}
        if v not in allowed:
            raise ValueError(f"rule_type must be one of {allowed}")
        return v

    @field_validator("hsn_prefix")
    @classmethod
    def validate_hsn_prefix(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("hsn_prefix cannot be empty")
        return v


class GSTHsnRuleResponse(BaseModel):
    id: int
    organization_id: Optional[str] = None
    hsn_prefix: str
    rule_type: str

    model_config = ConfigDict(from_attributes=True)
