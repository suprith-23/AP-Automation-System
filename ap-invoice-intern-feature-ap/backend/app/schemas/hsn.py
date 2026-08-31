"""Pydantic schemas for HSN master data requests and responses."""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class HSNBase(BaseModel):
    """Fields shared by HSN query, create, update, and response payloads."""
    description: Optional[str] = Field(None, description="Detailed product or service nomenclature description")
    tax_rate: Optional[float] = Field(None, description="Total standard GST rate (e.g. 18.0)")
    cgst_rate: Optional[float] = Field(None, description="Calculated or specified CGST rate (e.g. 9.0)")
    sgst_rate: Optional[float] = Field(None, description="Calculated or specified SGST rate (e.g. 9.0)")
    igst_rate: Optional[float] = Field(None, description="Calculated or specified IGST rate (e.g. 18.0)")


class HSNCreate(HSNBase):
    """Payload used to create or upsert an HSN code."""
    hsn_code: str = Field(..., description="HSN/SAC Code (4, 6, or 8 digits)", min_length=4, max_length=8)


class HSNUpdate(HSNBase):
    """Payload used to partially update an HSN code."""
    pass


class HSNResponse(HSNBase):
    """HSN record object returned by the API."""
    id: int
    hsn_code: str

    model_config = ConfigDict(from_attributes=True)


class HSNBulkUpsertRequest(BaseModel):
    """Request payload containing list of HSN codes to bulk-upsert."""
    hsn_codes: List[HSNCreate]


class HSNBulkUpsertResponse(BaseModel):
    """Response returned after performing a bulk HSN upsert operations."""
    inserted_count: int
    updated_count: int
    message: str
