"""Pipeline Orchestrator for managing multi-stage AP automation workflows."""
import os
import time
import logging
import asyncio
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor
import anyio
from typing import Optional
from sqlalchemy.orm import Session
from app.models.document import Document
from app.models.job import Job
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.schemas.invoice import InvoiceCreate
from app.services.invoice_service import create_invoice
from app.ai.services.ocr_service import extract_text_from_file_pipeline
from app.ai.extraction.pipeline import ExtractionPipeline
from app.validation.service import ValidationService
from app.matching.service import POMatchingService
from app.workflow.service import WorkflowService

logger = logging.getLogger("ingestion.orchestrator")

_process_executor = None

def get_process_executor() -> ProcessPoolExecutor:
    global _process_executor
    if _process_executor is None:
        # Limit worker count to avoid overallocating CPU (max 4, min 1)
        max_workers = max(1, min(4, (os.cpu_count() or 2) - 1))
        _process_executor = ProcessPoolExecutor(max_workers=max_workers)
    return _process_executor

class PipelineOrchestrator:
    def __init__(self, db: Session, max_retries: int = 3):
        self.db = db
        self.max_retries = max_retries

    async def run_pipeline(self, job_id: str, file_bytes: bytes, filename: str):
        """
        Coordinates execution of the AP automation stages by delegating
        to the central decoupled WorkflowOrchestrator.
        """
        from app.workflow.orchestrator import WorkflowOrchestrator
        orchestrator = WorkflowOrchestrator(self.db)
        await orchestrator.orchestrate_invoice_lifecycle(job_id, file_bytes, filename)
