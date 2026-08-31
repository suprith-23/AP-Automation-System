"""FastAPI application entry point."""

import os
import sys
import logging
import logging.config
from app.core.env import init_env
init_env()
from fastapi import FastAPI, Request, APIRouter
from prometheus_fastapi_instrumentator import Instrumentator

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "correlation": {
            "()": "app.middleware.correlation.CorrelationIdFilter"
        }
    },
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "fmt": "%(asctime)s %(levelname)s %(name)s %(message)s %(correlation_id)s %(request_id)s"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["correlation"],
            "stream": "ext://sys.stdout"
        }
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO"
    }
}
logging.config.dictConfig(LOGGING_CONFIG)

from fastapi import Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from app.core.database import engine, Base, get_db, SessionLocal
from app.schema_bootstrap import ensure_database_schema_current

# Import models so SQLAlchemy can register their tables.
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


from app.api.invoice_routes import router as invoice_router
from app.api.purchase_order_routes import router as purchase_order_router
from app.api.ai_routes import router as ai_routes
from app.api.audit_log_routes import router as audit_log_router
from app.api.hsn_routes import router as hsn_router
from app.api.dashboard_routes import router as dashboard_router
from app.api.workflow_routes import router as workflow_router
from app.api.ingestion_routes import router as ingestion_router
from app.diagnostics.ocr_health import router as diagnostics_router
from app.api.user_routes import router as user_router
from app.api.settings_routes import router as settings_router
from app.api.prompt_routes import router as prompt_router
from app.api.enterprise_routes import router as enterprise_router
from app.api.ai_provider_routes import router as ai_provider_router
from app.api.dlq_routes import router as dlq_router
from app.api.auth_routes import router as auth_router
from app.api.org_routes import router as org_router
from app.middleware.rate_limit import RateLimitMiddleware

from contextlib import asynccontextmanager
from app.ai.engine_registry import pre_warm_engines_async

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed AI provider table from env vars on first startup
    from app.ai.providers.registry import seed_db_from_env
    from app.core.bootstrap import bootstrap_superadmin
    from app.seed.vendor_seeder import seed_vendors
    if os.getenv("TESTING") != "True":
        seed_db_from_env()
        bootstrap_superadmin()
        db = SessionLocal()
        try:
            seed_vendors(db)
        finally:
            db.close()
        await pre_warm_engines_async()
    yield

# Create base tables for fresh databases, then reconcile unstamped schemas with Alembic.
if os.getenv("TESTING") != "True":
    Base.metadata.create_all(bind=engine)
    ensure_database_schema_current(engine)

app = FastAPI(
    title="AP Automation MVP API",
    description="Backend services for AP Automation MVP",
    version="1.0.0",
    lifespan=lifespan
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https://fastapi.tiangolo.com; "
        "frame-ancestors 'none';"
    )
    return response

# Allow requests from the local frontend in browser and Docker setups.
frontend_port = os.getenv("FRONTEND_PORT", "3000")
origins = [
    f"http://localhost:{frontend_port}",
    f"http://127.0.0.1:{frontend_port}",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-CSRF-Token"],
)
app.add_middleware(RateLimitMiddleware)
from app.middleware.csrf import CSRFMiddleware
app.add_middleware(CSRFMiddleware)
from app.middleware.correlation import CorrelationIdMiddleware
app.add_middleware(CorrelationIdMiddleware)
from app.middleware.metrics_middleware import PrometheusMetricsMiddleware
app.add_middleware(PrometheusMetricsMiddleware)


# Middleware to redirect legacy unversioned/duplicate paths to /api/v1/...
from fastapi.responses import RedirectResponse

@app.middleware("http")
async def legacy_redirect_middleware(request: Request, call_next):
    path = request.url.path
    query_string = request.url.query  # preserve query parameters
    suffix = f"?{query_string}" if query_string else ""

    # Skip assets, root, docs, openapi.json, metrics, etc.
    if path in ["/", "/docs", "/redoc", "/openapi.json", "/metrics"]:
        return await call_next(request)

    # If path starts with /api/v1, it's already versioned — pass through
    if path.startswith("/api/v1"):
        return await call_next(request)

    # Check if path needs to be redirected to /api/v1
    # 1. If it starts with /api/ (but not /api/v1)
    if path.startswith("/api/"):
        relative_path = path[5:]  # remove /api/
        return RedirectResponse(url=f"/api/v1/{relative_path}{suffix}", status_code=308)

    # 2. If it starts with any of the legacy unversioned path prefixes
    legacy_prefixes = [
        "/invoices", "/purchase-orders", "/dashboard", "/workflow", "/users",
        "/settings", "/prompts", "/hsn", "/dlq", "/audit-logs", "/health",
        "/ai/extract", "/extract-invoice", "/documents/", "/jobs/",
        "/auth/", "/organizations"
    ]
    for prefix in legacy_prefixes:
        if path.startswith(prefix):
            relative_path = path.lstrip("/")
            return RedirectResponse(url=f"/api/v1/{relative_path}{suffix}", status_code=308)

    return await call_next(request)


# Register API route groups under /api/v1 for versioning and as fallback.
from app.api.whatsapp_ingestion import router as whatsapp_ingestion_router
from app.api.resend_webhook import router as resend_webhook_router
from app.api.brevo_webhook import router as brevo_webhook_router

api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(invoice_router)
api_v1.include_router(purchase_order_router)
api_v1.include_router(ai_routes)
api_v1.include_router(audit_log_router)
api_v1.include_router(hsn_router)
api_v1.include_router(dashboard_router)
api_v1.include_router(diagnostics_router)
api_v1.include_router(workflow_router)
api_v1.include_router(ingestion_router)
api_v1.include_router(user_router)
api_v1.include_router(settings_router)
api_v1.include_router(prompt_router)
api_v1.include_router(enterprise_router)
api_v1.include_router(whatsapp_ingestion_router)
api_v1.include_router(resend_webhook_router)
api_v1.include_router(brevo_webhook_router)
api_v1.include_router(ai_provider_router)
api_v1.include_router(dlq_router)
api_v1.include_router(auth_router)
from app.api.admin_metrics import router as admin_metrics_router
api_v1.include_router(admin_metrics_router)
from app.api.tds_rules_routes import router as tds_rules_router
api_v1.include_router(tds_rules_router)
from app.api.gst_hsn_routes import router as gst_hsn_router
api_v1.include_router(gst_hsn_router)
from app.api.org_key_routes import router as org_key_router
api_v1.include_router(org_router)
api_v1.include_router(org_key_router)
from app.api.super_admin_routes import router as super_admin_router
api_v1.include_router(super_admin_router)

from app.webhooks.sandbox import router as webhook_sandbox_router
api_v1.include_router(webhook_sandbox_router)

from app.api.integrations_routes import router as integrations_router
api_v1.include_router(integrations_router)

from app.api.payment_routes import router as payment_router
api_v1.include_router(payment_router)

from app.api.reviewer_routes import router as reviewer_router
api_v1.include_router(reviewer_router)
from app.api.vendor_routes import router as vendor_router
api_v1.include_router(vendor_router)



@api_v1.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Check API and database connectivity."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "database": f"disconnected: {str(exc)}"
        }

@api_v1.get("/health/live")
def health_live():
    """Liveness probe. Fast-returning response to indicate process is running."""
    return {"status": "alive"}

from fastapi import HTTPException
import redis

@api_v1.get("/health/ready")
def health_ready(db: Session = Depends(get_db)):
    """Readiness probe. Checks all critical infrastructure dependencies (DB, Redis, Celery, Storage, OCR, AI)."""
    # 1. Database Check
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(exc)}")

    # 2. Configuration Check
    try:
        from app.core.config.config_loader import CONFIG
        _ = CONFIG.validation_rules
        config_status = "loaded"
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Configuration loading failed: {str(exc)}")

    # 3. Redis Check
    try:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0" if os.path.exists("/.dockerenv") else "redis://localhost:6379/0")
        r = redis.from_url(redis_url, socket_timeout=1.0)
        r.ping()
        redis_status = "connected"
    except Exception as exc:
        redis_status = f"disconnected: {str(exc)}"

    # 4. Celery Queue Length & Worker status Check
    try:
        queue_length = r.llen("celery")
        celery_status = "connected"
    except Exception:
        queue_length = 0
        celery_status = "unavailable"

    # 5. Storage connectivity Check
    try:
        from app.ingestion.storage import get_storage_provider
        provider = get_storage_provider()
        if hasattr(provider, "base_dir"):
            if os.path.exists(provider.base_dir) and os.access(provider.base_dir, os.W_OK):
                storage_status = "connected"
            else:
                storage_status = "unwritable"
        else:
            if provider.use_local:
                storage_status = "connected (local fallback)"
            else:
                storage_status = "connected" if hasattr(provider, "s3_client") else "disconnected"
    except Exception as exc:
        storage_status = f"error: {str(exc)}"

    # 6. OCR Engine Check
    ocr_status = "available"
    try:
        from app.ai.ocr_engine import RapidOCREngine
        from app.ai.docling_engine import DoclingEngine
        ocr_status = {
            "RapidOCR": "loaded" if RapidOCREngine._instance is not None else "unloaded",
            "Docling": "loaded" if DoclingEngine._instance is not None else "unloaded"
        }
    except Exception:
        ocr_status = "error"

    # 7. AI Providers Check
    ai_status = {}
    for prov in ["groq", "gemini", "nvidia", "huggingface"]:
        key_name = f"{prov.upper()}_API_KEY"
        val = os.getenv(key_name)
        ai_status[prov] = "configured" if val and "your_" not in val else "unconfigured"

    # 8. SMTP Check
    from app.workflow.notifications import EmailNotificationService
    try:
        email_service = EmailNotificationService()
        smtp_status = "configured" if email_service.is_configured else "unconfigured"
    except Exception as exc:
        smtp_status = f"error: {str(exc)}"

    # Check if any critical service is down
    app_env = os.getenv("APP_ENV", "development").lower()
    if (
        "disconnected" in redis_status
        or celery_status == "unavailable"
        or "unwritable" in storage_status
        or (app_env in ("production", "staging") and smtp_status != "configured")
    ):
        raise HTTPException(status_code=503, detail={
            "status": "degraded",
            "database": db_status,
            "configuration": config_status,
            "redis": redis_status,
            "celery": celery_status,
            "storage": storage_status,
            "smtp": smtp_status
        })

    return {
        "status": "ready",
        "database": db_status,
        "configuration": config_status,
        "redis": redis_status,
        "celery": {
            "status": celery_status,
            "queue_length": queue_length
        },
        "storage": storage_status,
        "smtp": smtp_status,
        "ocr": ocr_status,
        "ai_providers": ai_status
    }

# Mount the versioned api_v1 router to the app
app.include_router(api_v1)

# Instrument the app for metrics
Instrumentator().instrument(app)

from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response, HTTPException

@app.get("/metrics")
def metrics(request: Request):
    client_host = request.client.host if request.client else "unknown"
    is_internal = (
        client_host in ("127.0.0.1", "localhost", "::1", "testclient") or
        client_host.startswith("172.") or
        client_host.startswith("10.") or
        client_host.startswith("192.168.")
    )
    if not is_internal:
        token = request.cookies.get("access_token")
        if token:
            from app.core.security.jwt import decode_token
            payload = decode_token(token)
            if payload and payload.get("role") == "Super Admin":
                is_internal = True
                
    if not is_internal:
        raise HTTPException(status_code=403, detail="Access denied. Internal network only.")
        
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/")
def home():
    """Return a simple status message."""
    return {
        "message": "AP Automation MVP Backend Running"
    }

from app.middleware.exception_handlers import global_exception_handler

@app.exception_handler(Exception)
async def catch_all_exception_handler(request: Request, exc: Exception):
    return await global_exception_handler(request, exc)

@app.exception_handler(OperationalError)
async def db_operational_error_handler(request: Request, exc: OperationalError):
    return await global_exception_handler(request, exc)

