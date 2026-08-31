"""AI extraction API routes."""

import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.core.database import get_db
from app.ai.schemas.extraction_schema import ExtractionSchema
from app.services.ingestion_orchestrator import IngestionOrchestrator
from app.schemas.invoice import InvoiceResponse

from app.dependencies import get_current_user

router = APIRouter(
    dependencies=[Depends(get_current_user)]
)
logger = logging.getLogger("ap_automation.ai_routes")


class ExtractInvoiceResponse(BaseModel):
    invoice_data: Dict[str, Any]
    validation_result: Dict[str, Any]
    confidence: Dict[str, Any]
    invoice: Optional[InvoiceResponse] = None


@router.post("/ai/extract", response_model=ExtractionSchema)
async def extract_invoice(file: UploadFile = File(...)):
    """
    Purpose:
        Perform OCR on uploaded PDF or Image, send text to Groq, and return structured JSON.
    Inputs:
        - file (UploadFile): PDF or Image file.
    Outputs:
        - ExtractionSchema: The extracted and structured JSON fields.
    """
    file_bytes = await file.read()
    result = await IngestionOrchestrator.process_raw_extraction(file_bytes, file.filename)
    return result.get("invoice_data") if "invoice_data" in result else result


@router.post("/extract-invoice", response_model=ExtractInvoiceResponse)
async def extract_invoice_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Purpose:
        Perform OCR, extract fields via Groq LLM, validate results, persist invoice record, and return structured telemetry.
    Inputs:
        - file (UploadFile): PDF, PNG, JPG, or JPEG file.
        - db (Session): Database connection session.
    Outputs:
        - ExtractInvoiceResponse: The structured results including confidence scores and validation errors.
    """
    file_bytes = await file.read()
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    return await IngestionOrchestrator.process_and_persist_invoice(db, file_bytes, file.filename, organization_id=org_id)
