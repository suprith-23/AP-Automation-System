"""Orchestrator executing the sequential steps of the AP Automation workflow."""
import logging
import time
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.job import Job
from app.models.document import Document
from app.workflow.models import WorkflowInstance
from app.workflow.state_machine import WorkflowState as WState
from app.workflow.engine import WorkflowEngine
from app.workflow.manager import WorkflowManager
from app.workflow.transitions import TransitionRunner
from app.workflow.sla import SLAMonitor
from app.workflow.exceptions import WorkflowException

logger = logging.getLogger("workflow.orchestrator")

class WorkflowOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.manager = WorkflowManager()
        self.engine = WorkflowEngine()

    async def orchestrate_invoice_lifecycle(self, job_id: str, file_bytes: bytes, filename: str) -> None:
        """
        Sequentially runs invoice processing lifecycle transitions (OCR -> AI -> Validation -> GST -> TDS -> PO Matching -> Approvals).
        """
        # Lock the job record to prevent concurrent Celery tasks from processing the same job ID
        job = self.db.query(Job).filter(Job.id == job_id).with_for_update().first()
        if not job:
            logger.error(f"Job {job_id} not found in database.")
            return

        job.status = "processing"
        job.current_stage = "OCR"
        self.db.commit()

        # Re-fetch job to get active session state
        job = self.db.query(Job).filter(Job.id == job_id).first()
        stages_meta = job.stages_metadata.copy() if job.stages_metadata else {}
        requested_prompt_version = stages_meta.get("requested_prompt_version")

        # 1. Get or create Invoice record in DRAFT — guard against Celery retries
        #    creating duplicates by checking for an existing row for this document first (using locking).
        invoice = None
        if job.document_id:
            invoice = self.db.query(Invoice).filter(Invoice.document_id == job.document_id).with_for_update().first()

        if invoice is None:
            org_id = job.stages_metadata.get("organization_id") if job.stages_metadata else None
            src_type = job.stages_metadata.get("source_type", "file_upload") if job.stages_metadata else "file_upload"
            invoice = Invoice(
                status=WState.DRAFT,
                source_type=src_type,
                document_id=job.document_id,
                organization_id=org_id
            )
            self.db.add(invoice)
            self.db.commit()
            self.db.refresh(invoice)
        else:
            # Resume from existing record — reset status so workflow can re-run from DRAFT
            invoice.status = WState.DRAFT
            instance = self.db.query(WorkflowInstance).filter(WorkflowInstance.invoice_id == invoice.id).first()
            if instance:
                instance.current_state = WState.DRAFT
                instance.error_message = None
            self.db.commit()
            self.db.refresh(invoice)
            logger.info(f"Resuming existing invoice {invoice.id} for document_id={job.document_id} (Celery retry?)")

        # Update job document details
        if job.document_id:
            doc = self.db.query(Document).filter(Document.id == job.document_id).first()
            if doc:
                doc.status = "processed"
                self.db.commit()

        invoice_id = invoice.id
        tenant_id = str(invoice.organization_id) if invoice.organization_id else "global"

        try:
            # Start Processing SLA timer (2 Hours)
            SLAMonitor.start_sla(self.db, invoice_id, "PROCESSING", duration_hours=2)

            # Stage: START WORKFLOW (transitions to RECEIVED)
            self.manager.start_workflow(self.db, invoice_id)

            # Stage: RECEIVED -> INGESTED
            self.manager.advance_workflow(self.db, invoice_id, WState.INGESTED, reason="Invoice saved to system metadata.")

            # Stage: INGESTED -> OCR_COMPLETED
            job.current_stage = "OCR"
            self.db.commit()
            
            import os
            is_testing = os.getenv("TESTING") == "True"
            
            # Decouple: Close DB connection to return it to the pool during long OCR process
            if not is_testing:
                self.db.close()
            
            ocr_start = datetime.utcnow()
            # Do OCR without DB
            from app.ai.services.ocr_service import extract_text_from_file_pipeline
            ocr_raw_res = extract_text_from_file_pipeline(file_bytes, filename)
            
            # Re-acquire DB connection after OCR
            if not is_testing:
                from app.core.database import SessionLocal
                self.db = SessionLocal()
            
            ocr_res = TransitionRunner.execute_ocr(self.db, invoice_id, file_bytes, filename, ocr_raw_res)
            stages_meta["ocr_start"] = ocr_start.isoformat()
            stages_meta["ocr_end"] = datetime.utcnow().isoformat()
            stages_meta["ocr_duration_sec"] = ocr_res["duration_sec"]
            stages_meta["ocr_provider"] = ocr_res.get("metadata", {}).get("provider") or "Unknown"
            stages_meta["ocr_confidence"] = ocr_res.get("metadata", {}).get("confidence") or 1.0
            
            self.manager.advance_workflow(self.db, invoice_id, WState.OCR_COMPLETED, reason="OCR scanning finished successfully.")

            # Stage: OCR_COMPLETED -> AI_EXTRACTED
            job = self.db.query(Job).filter(Job.id == job_id).first()
            job.current_stage = "EXTRACTION"
            self.db.commit()
            

            # Decouple: Close DB connection during long LLM extraction process
            if not is_testing:
                self.db.close()
            
            ext_start = datetime.utcnow()
            # Do LLM Extraction without DB
            from app.ai.extraction.pipeline import ExtractionPipeline
            extraction_raw_res = await ExtractionPipeline.process(ocr_res["ocr_result"], prompt_version=requested_prompt_version, tenant_id=tenant_id)
            
            # Re-acquire DB connection after LLM
            if not is_testing:
                from app.core.database import SessionLocal
                self.db = SessionLocal()
            
            ext_res = await TransitionRunner.execute_ai_extraction(
                self.db, invoice_id, ocr_res["ocr_result"], requested_prompt_version, extraction_raw_res
            )
            stages_meta["extraction_start"] = ext_start.isoformat()
            stages_meta["extraction_end"] = datetime.utcnow().isoformat()
            stages_meta["extraction_duration_sec"] = ext_res["duration_sec"]
            stages_meta["prompt_version_used"] = ext_res["prompt_version_used"]
            self.manager.advance_workflow(self.db, invoice_id, WState.AI_EXTRACTED, reason="AI extraction processed fields.")

            # Stage: AI_EXTRACTED -> VALIDATED
            val_start = datetime.utcnow()
            job.current_stage = "VALIDATION"
            self.db.commit()
            TransitionRunner.execute_validation(self.db, invoice_id)
            stages_meta["validation_start"] = val_start.isoformat()
            stages_meta["validation_end"] = datetime.utcnow().isoformat()
            stages_meta["validation_duration_sec"] = (datetime.utcnow() - val_start).total_seconds()
            self.manager.advance_workflow(self.db, invoice_id, WState.VALIDATED, reason="Base validations evaluated.")

            # Stage: VALIDATED -> GST_VERIFIED
            gst_start = datetime.utcnow()
            job.current_stage = "GST_VERIFICATION"
            self.db.commit()
            TransitionRunner.execute_gst_verification(self.db, invoice_id)
            stages_meta["gst_start"] = gst_start.isoformat()
            stages_meta["gst_end"] = datetime.utcnow().isoformat()
            stages_meta["gst_duration_sec"] = (datetime.utcnow() - gst_start).total_seconds()
            self.manager.advance_workflow(self.db, invoice_id, WState.GST_VERIFIED, reason="GST reconciliation & compliance checked.")

            # Stage: GST_VERIFIED -> TDS_VERIFIED
            tds_start = datetime.utcnow()
            job.current_stage = "TDS_CALCULATION"
            self.db.commit()
            TransitionRunner.execute_tds_calculation(self.db, invoice_id)
            stages_meta["tds_start"] = tds_start.isoformat()
            stages_meta["tds_end"] = datetime.utcnow().isoformat()
            stages_meta["tds_duration_sec"] = (datetime.utcnow() - tds_start).total_seconds()
            self.manager.advance_workflow(self.db, invoice_id, WState.TDS_VERIFIED, reason="TDS rate analysis done.")

            # Stage: TDS_VERIFIED -> PO_MATCHED
            po_start = datetime.utcnow()
            job.current_stage = "MATCHING"
            self.db.commit()
            TransitionRunner.execute_po_matching(self.db, invoice_id)
            stages_meta["po_start"] = po_start.isoformat()
            stages_meta["po_end"] = datetime.utcnow().isoformat()
            stages_meta["po_duration_sec"] = (datetime.utcnow() - po_start).total_seconds()
            self.manager.advance_workflow(self.db, invoice_id, WState.PO_MATCHED, reason="Purchase Order matching checks verified.")

            # Stage: PO_MATCHED -> READY_FOR_APPROVAL
            self.manager.advance_workflow(self.db, invoice_id, WState.READY_FOR_APPROVAL, reason="Workflow stages completed. Evaluating approval logic.")

            # Stage: READY_FOR_APPROVAL -> APPROVED / UNDER_REVIEW / ON_HOLD
            self.manager.evaluate_approvals(self.db, invoice_id)

            # End processing SLA
            SLAMonitor.resolve_sla(self.db, invoice_id, "PROCESSING")

            job.status = "completed"
            job.current_stage = "DONE"
            stages_meta["completed_at"] = datetime.utcnow().isoformat()
            job.stages_metadata = stages_meta
            self.db.commit()

            try:
                # Query only specific columns as a tuple to avoid DetachedInstanceError
                inv_data = self.db.query(
                    Invoice.invoice_number,
                    Invoice.vendor_name,
                    Invoice.total_amount,
                    Invoice.currency,
                    Invoice.source_type,
                    Invoice.organization_id,
                    Invoice.status
                ).filter(Invoice.id == invoice_id).first()

                if inv_data:
                    from app.notifications.service import NotificationService
                    source_str = inv_data.source_type.replace("_", " ").title() if inv_data.source_type else "Unknown"
                    NotificationService.notify(
                        db=self.db,
                        event_type="INVOICE_RECEIVED",
                        invoice_id=invoice_id,
                        tenant_id=str(inv_data.organization_id) if inv_data.organization_id else "global",
                        message=f"New invoice received via **{source_str}**.\n**Invoice #:** {inv_data.invoice_number or 'N/A'}\n**Vendor:** {inv_data.vendor_name or 'N/A'}\n**Amount:** {inv_data.currency or 'INR'} {inv_data.total_amount or 0.0:.2f}",
                        severity="INFO",
                        metadata={
                            "invoice_number": inv_data.invoice_number,
                            "vendor_name": inv_data.vendor_name,
                            "total_amount": inv_data.total_amount,
                            "source_type": inv_data.source_type,
                            "status": inv_data.status
                        }
                    )
            except Exception as notify_err:
                logger.error(f"Failed to dispatch Discord notification for invoice received: {notify_err}", exc_info=True)

        except Exception as e:
            logger.exception(f"Workflow orchestrator failure on job {job_id}: {str(e)}")
            self.db.rollback()
            
            try:
                from app.core.metrics import INVOICE_PROCESSING_ERROR
                inv = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()
                tenant_id = str(inv.organization_id) if inv and inv.organization_id else "global"
                INVOICE_PROCESSING_ERROR.labels(stage=job.current_stage or "unknown", tenant_id=tenant_id).inc()
            except Exception:
                pass
                
            # Record failed state in instance
            instance = self.db.query(WorkflowInstance).filter(WorkflowInstance.invoice_id == invoice_id).first()
            if instance:
                instance.current_state = WState.FAILED
                instance.error_message = str(e)
                self.db.commit()

            # Record failed state in job
            job = self.db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "failed"
                job.current_stage = "ERROR"
                job.error_message = str(e)
                job.stages_metadata = stages_meta
                self.db.commit()

                if job.document_id:
                    doc = self.db.query(Document).filter(Document.id == job.document_id).first()
                    if doc:
                        doc.status = "failed"
                        self.db.commit()
