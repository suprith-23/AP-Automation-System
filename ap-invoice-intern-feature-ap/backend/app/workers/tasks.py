import asyncio
import logging
import traceback
import os
from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.ingestion.orchestrator import PipelineOrchestrator
from app.utils.secrets import secrets
from app.ingestion.storage import get_storage_provider

# Import all models to register them with SQLAlchemy Base in the Celery worker process
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder
from app.models.audit_log import AuditLog
from app.models.hsn_master import HSNMaster
from app.models.document import Document
from app.models.job import Job
from app.models.user import User
from app.models.otp_verification import OTPVerification
from app.models.organization import Organization
from app.models.settings import Settings
from app.models.prompt_version import PromptVersion
from app.models.tds import TDSSection, TDSLedgerEntry
from app.models.gst_hsn_rule import GSTHsnRule
from app.models.po_item import PurchaseOrderItem, GRN, GRNItem
from app.models.approval import ApprovalRule, ApprovalRequest, ApprovalHistory
from app.models.payment import PaymentSchedule, PaymentTransaction, CreditDebitNote, PaymentGatewayConfig
from app.models.exception_record import InvoiceException
from app.models.ai_provider_config import AIProviderConfig
from app.models.failed_task import FailedTask
from app.models.erp_sync_log import ERPSyncLog
from app.models.vendor import Vendor
from app.models.comment import InvoiceComment
from app.workflow.models import (
    WorkflowInstance,
    WorkflowState,
    WorkflowHistory,
    WorkflowEvent,
    WorkflowApprovalRequest,
    WorkflowApprovalAction,
    SLARecord,
    EscalationRecord
)

logger = logging.getLogger("celery.tasks")

import time
import redis
from celery.signals import task_prerun, task_postrun, before_task_publish
from app.core.metrics import (
    CELERY_TASK_DURATION, 
    CELERY_TASK_FAILURES, 
    CELERY_QUEUE_DEPTH,
    WEBHOOK_DELIVERY_TOTAL,
    WEBHOOK_DELIVERY_DURATION,
    NOTIFICATION_DELIVERY_TOTAL
)

def update_queue_depth():
    try:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0" if os.path.exists("/.dockerenv") else "redis://localhost:6379/0")
        r = redis.from_url(redis_url, socket_timeout=1.0)
        q_len = r.llen("celery")
        CELERY_QUEUE_DEPTH.labels(queue="celery").set(q_len)
    except Exception:
        pass

@before_task_publish.connect
def on_task_publish(sender=None, headers=None, body=None, **kwargs):
    update_queue_depth()

@task_prerun.connect
def on_task_prerun(task_id, task, args, kwargs, **info):
    task._start_time = time.time()
    update_queue_depth()

@task_postrun.connect
def on_task_postrun(task_id, task, args, kwargs, retval, state, **info):
    update_queue_depth()
    if hasattr(task, "_start_time"):
        duration = time.time() - task._start_time
        CELERY_TASK_DURATION.labels(task_name=task.name).observe(duration)
    if state == "FAILURE":
        CELERY_TASK_FAILURES.labels(task_name=task.name).inc()


@celery_app.task(name="app.tasks.run_document_ingestion", bind=True, max_retries=3)
def run_document_ingestion(self, job_id: str, document_id: int):
    logger.info(f"Starting background Celery ingestion task for job {job_id} (Attempt {self.request.retries + 1})")
    
    max_retries = int(secrets.get_secret("MAX_RETRIES", "3"))
    retry_delay = float(secrets.get_secret("RETRY_DELAY", "5.0"))
    backoff_factor = float(secrets.get_secret("BACKOFF_FACTOR", "2.0"))
    
    self.max_retries = max_retries

    # Phase 1: short-lived DB session — only fetch metadata (storage path, filename).
    # Close immediately so the connection is returned to the pool before long-running
    # OCR/LLM API calls begin.
    file_bytes = None
    filename = None
    db_fetch = SessionLocal()
    try:
        from app.models.document import Document
        doc = db_fetch.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise ValueError(f"Document {document_id} not found.")
        storage_path = doc.storage_path
        filename = doc.filename
    finally:
        db_fetch.close()  # Return connection to pool BEFORE external OCR/LLM calls

    # Phase 2: long-running OCR/LLM processing — no DB connection held during this.
    try:
        storage_provider = get_storage_provider()
        file_bytes = storage_provider.get(storage_path)
    except Exception as e:
        logger.error(f"Failed to retrieve document {document_id} from storage: {e}")
        raise

    # Phase 3: second short-lived DB session for pipeline execution and writes.
    db_write = SessionLocal()
    try:
        orchestrator = PipelineOrchestrator(db_write)
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        loop.run_until_complete(orchestrator.run_pipeline(job_id, file_bytes, filename))
        logger.info(f"Successfully completed background Celery ingestion task for job {job_id}")
    except Exception as e:
        logger.error(
            f"Error during background Celery ingestion task for job {job_id} "
            f"(Attempt {self.request.retries + 1}): {e}",
            exc_info=True,
        )

        import httpx
        from sqlalchemy.exc import OperationalError

        def is_transient_error(err: Exception) -> bool:
            if isinstance(err, httpx.HTTPStatusError):
                return err.response.status_code in (429, 500, 502, 503, 504)
            if isinstance(err, (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.WriteTimeout, httpx.TimeoutException)):
                return True
            if isinstance(err, OperationalError):
                return True
            err_str = str(err).lower()
            if "timeout" in err_str or "rate limit" in err_str or "429" in err_str or "503" in err_str or "connection" in err_str:
                return True
            return False

        if is_transient_error(e) and self.request.retries < self.max_retries:
            countdown = retry_delay * (backoff_factor ** self.request.retries)
            logger.info(f"Transient error detected. Scheduling retry in {countdown:.2f} seconds...")
            raise self.retry(exc=e, countdown=countdown)
        else:
            logger.error(f"Permanent error or retries exhausted for job {job_id}. Moving to DLQ.")
            from app.models.failed_task import FailedTask

            failed_task_record = FailedTask(
                task_name="app.tasks.run_document_ingestion",
                invoice_id=job_id,
                failure_reason=str(e),
                retry_count=self.request.retries,
                stack_trace=traceback.format_exc()
            )
            try:
                db_write.add(failed_task_record)
                db_write.commit()
            except Exception as db_err:
                logger.error(f"Failed to write to DLQ database: {db_err}")
            raise e
    finally:
        db_write.close()


@celery_app.task(name="app.tasks.retry_failed_invoices")
def retry_failed_invoices():
    logger.info("Celery Beat: Retrying failed invoices...")
    db = SessionLocal()
    try:
        from app.models.job import Job
        from app.models.document import Document
        
        # Retry jobs that are failed or pending for too long
        failed_jobs = db.query(Job).filter(Job.status == "failed").all()
        logger.info(f"Found {len(failed_jobs)} failed jobs to retry.")
        
        for job in failed_jobs:
            doc = db.query(Document).filter(Document.id == job.document_id).first()
            if not doc:
                continue
                
            try:
                run_document_ingestion.delay(job.id, doc.id)
                logger.info(f"Re-scheduled failed job {job.id} for processing.")
            except Exception as retry_err:
                logger.error(f"Failed to reschedule job {job.id}: {retry_err}")
    except Exception as e:
        logger.error(f"Error in retry_failed_invoices task: {e}")
    finally:
        db.close()


@celery_app.task(name="app.tasks.cleanup_temp_ocr_files")
def cleanup_temp_ocr_files():
    logger.info("Celery Beat: Cleaning up temporary OCR files...")
    # Mocking temp file cleanup
    temp_dir = "/tmp/ocr"
    if os.path.exists(temp_dir):
        logger.info(f"Cleaning files in {temp_dir}")
    else:
        logger.info("No temporary OCR directory found. Skipping.")


@celery_app.task(name="app.tasks.db_backup_trigger")
def db_backup_trigger():
    logger.info("Celery Beat: Triggering daily database backup...")
    import subprocess
    try:
        # Trigger postgres backup script if it exists
        backup_script = "/app/scripts/backup.sh"
        if os.path.exists(backup_script):
            subprocess.run(["bash", backup_script], check=True)
            logger.info("Backup script executed successfully.")
        else:
            logger.warning("Backup script not found at /app/scripts/backup.sh")
    except Exception as e:
        logger.error(f"Failed to execute backup script: {e}")


@celery_app.task(name="app.tasks.email_polling")
def email_polling():
    logger.info("Celery Beat: Polling emails...")
    db = SessionLocal()
    try:
        from app.ingestion.email_ingestion import EmailIngestionService
        service = EmailIngestionService(db)
        service.poll_mailbox()
    except Exception as e:
        logger.error(f"Error during email polling task: {e}")
    finally:
        db.close()


@celery_app.task(name="app.tasks.health_verification")
def health_verification():
    logger.info("Celery Beat: Running health verification diagnostics...")
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        logger.info("Health verification: Database connection OK.")
    except Exception as e:
        logger.error(f"Health verification: Database connection check failed: {e}")
    finally:
        db.close()



@celery_app.task(name="app.tasks.sync_invoice_to_erp", bind=True, max_retries=3, default_retry_delay=30)
def sync_invoice_to_erp(self, invoice_id: int):
    """
    Background task: Sync an approved invoice to all configured ERP systems (Odoo, etc.).
    Called asynchronously after invoice approval to avoid blocking the HTTP response.
    """
    logger.info(f"Starting ERP sync for invoice {invoice_id}")
    db = SessionLocal()
    try:
        from app.models.invoice import Invoice
        from app.services.integrations_manager import ERPIntegrationsManager
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            logger.warning(f"ERP sync: invoice {invoice_id} not found, skipping")
            return
        ERPIntegrationsManager.sync_invoice_to_all(db, invoice)
        logger.info(f"ERP sync completed for invoice {invoice_id}")
    except Exception as exc:
        logger.error(f"ERP sync failed for invoice {invoice_id}: {exc}", exc_info=True)
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error(f"ERP sync permanently failed for invoice {invoice_id} after max retries")
    finally:
        db.close()


@celery_app.task(name="app.tasks.dispatch_webhook_task", bind=True, max_retries=5, default_retry_delay=10)
def dispatch_webhook_task(self, tenant_id: str, event_id: str, event_type: str, payload: dict):
    """
    Background task: Dispatch a canonical webhook event.
    """
    logger.info(f"Starting Webhook Delivery for event {event_id} (Attempt {self.request.retries + 1})")
    db = SessionLocal()
    try:
        from app.models.settings import Settings
        from app.models.webhook_delivery import WebhookDelivery
        import httpx
        import hmac
        import hashlib
        from datetime import datetime, timezone

        settings = db.query(Settings).first()
        if not settings or not settings.webhook_url:
            logger.warning(f"Webhook delivery skipped for {event_id}: URL not configured")
            return

        webhook_url = settings.webhook_url
        webhook_secret = settings.webhook_secret or ""
        
        # Determine URL if Internal Sandbox is used
        if settings.webhook_provider == "INTERNAL_SANDBOX":
            webhook_url = "http://localhost:8000/api/v1/webhooks/sandbox"

        # Record delivery attempt
        delivery = WebhookDelivery(
            delivery_id=f"del_{self.request.id}",
            event_id=event_id,
            tenant_id=tenant_id,
            event_type=event_type,
            provider=settings.webhook_provider,
            status="PENDING",
            attempt=self.request.retries + 1,
            payload=payload,
        )
        db.add(delivery)
        db.commit()

        # Sign payload
        raw_body = httpx.Client().build_request("POST", webhook_url, json=payload).content
        signature = hmac.new(
            webhook_secret.encode('utf-8'),
            raw_body,
            hashlib.sha256
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature
        }

        # Send
        start_time = time.time()
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(webhook_url, json=payload, headers=headers)
                delivery.response_code = resp.status_code
                delivery.response_body_summary = resp.text[:255]
                delivery.latency_ms = (time.time() - start_time) * 1000
                delivery.completed_at = datetime.now(timezone.utc)
                
                resp.raise_for_status()
                delivery.status = "DELIVERED"
                db.commit()
                logger.info(f"Webhook {event_id} delivered successfully to {webhook_url}")
                
                WEBHOOK_DELIVERY_TOTAL.labels(status="success", provider=settings.webhook_provider, tenant_id=tenant_id).inc()
                WEBHOOK_DELIVERY_DURATION.labels(provider=settings.webhook_provider).observe(time.time() - start_time)

        except Exception as e:
            delivery.response_code = getattr(e, 'response', None) and e.response.status_code
            delivery.response_body_summary = str(e)[:255]
            delivery.latency_ms = (time.time() - start_time) * 1000
            delivery.status = "FAILED"
            delivery.completed_at = datetime.now(timezone.utc)
            db.commit()
            
            logger.error(f"Webhook {event_id} delivery failed: {e}")
            WEBHOOK_DELIVERY_TOTAL.labels(status="failed", provider=settings.webhook_provider, tenant_id=tenant_id).inc()
            WEBHOOK_DELIVERY_DURATION.labels(provider=settings.webhook_provider).observe(time.time() - start_time)
            
            self.retry(exc=e, countdown=10 * (2 ** self.request.retries))

    except Exception as exc:
        logger.error(f"Fatal error in webhook dispatcher for {event_id}: {exc}")
        if not isinstance(exc, self.MaxRetriesExceededError):
            try:
                self.retry(exc=exc)
            except self.MaxRetriesExceededError:
                pass
    finally:
        db.close()


@celery_app.task(name="app.tasks.dispatch_notification_task", bind=True, max_retries=3, default_retry_delay=5)
def dispatch_notification_task(self, tenant_id: str, event_type: str, invoice_id: str, message: str, severity: str, metadata: dict):
    """
    Background task: Dispatch human-readable notifications.
    """
    logger.info(f"Starting Notification Delivery for {event_type} on invoice {invoice_id}")
    db = SessionLocal()
    try:
        from app.models.settings import Settings
        from app.notifications.providers.discord import DiscordProvider
        import uuid
        import os

        org_uuid = None
        if tenant_id and tenant_id != "global":
            try:
                org_uuid = uuid.UUID(tenant_id)
            except ValueError:
                pass

        settings = Settings.get_for_organization(db, org_uuid)
        if not settings:
            return

        success = True
        
        # Discord Delivery
        discord_webhook_url = settings.discord_webhook_url or os.getenv("DISCORD_WEBHOOK_URL")
        if discord_webhook_url:
            discord_success = DiscordProvider.send_notification(
                webhook_url=discord_webhook_url,
                event_type=event_type,
                invoice_id=invoice_id,
                message=message,
                severity=severity,
                metadata=metadata
            )
            success = success and discord_success
            status = "success" if discord_success else "failed"
            NOTIFICATION_DELIVERY_TOTAL.labels(status=status, provider="discord", severity=severity, tenant_id=tenant_id).inc()

        if not success:
            raise Exception("One or more notification providers failed")

    except Exception as exc:
        logger.error(f"Notification delivery failed: {exc}")
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            pass
    finally:
        db.close()
