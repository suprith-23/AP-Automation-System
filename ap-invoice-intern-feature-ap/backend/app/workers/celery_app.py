import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
if os.path.exists("/.dockerenv"):
    REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "ap_automation_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

if os.getenv("TESTING") == "True":
    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
    )

# Celery Beat schedule configuration with overrides from environment variables
celery_app.conf.beat_schedule = {
    "retry-failed-invoices-periodic": {
        "task": "app.tasks.retry_failed_invoices",
        "schedule": float(os.getenv("SCHED_RETRY_FAILED_INVOICES", "3600")),
    },
    "cleanup-temp-ocr-files-periodic": {
        "task": "app.tasks.cleanup_temp_ocr_files",
        "schedule": float(os.getenv("SCHED_CLEANUP_TEMP_FILES", "86400")),
    },
    "db-backup-trigger-periodic": {
        "task": "app.tasks.db_backup_trigger",
        "schedule": float(os.getenv("SCHED_DB_BACKUP", "86400")),
    },
    "email-polling-periodic": {
        "task": "app.tasks.email_polling",
        "schedule": float(os.getenv("SCHED_EMAIL_POLLING", "300")),
    },
    "health-verification-periodic": {
        "task": "app.tasks.health_verification",
        "schedule": float(os.getenv("SCHED_HEALTH_VERIFICATION", "60")),
    },
}
