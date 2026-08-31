from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from uuid import UUID
from datetime import datetime
from typing import List, Dict, Any

class SourceChannel(str, Enum):
    email = "email"
    whatsapp = "whatsapp"
    smtp = "smtp"
    api = "api"
    vendor_portal = "vendor_portal"
    ftps = "ftps"

class IngestedDocument(BaseModel):
    ingest_id: UUID = Field(..., description="Idempotency key generated via the content-hash of the raw file payload.")
    source_channel: SourceChannel = Field(..., description="Ingestion source channel channel classification.")
    source_identifier: str = Field(..., description="Sender or system identifier mapping back to source channel config.")
    raw_payload_ref: str = Field(..., description="Storage path reference to the raw file saved in the storage provider.")
    received_at: datetime = Field(default_factory=datetime.utcnow, description="ISO-8601 ingestion timestamp.")
    attachment_refs: List[str] = Field(default_factory=list, description="List of storage path references for associated document attachments.")
    channel_metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata dictionary for channel-specific attributes.")

    model_config = ConfigDict(from_attributes=True)
