from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.failed_task import FailedTask
from app.models.document import Document
from app.models.job import Job
from app.ingestion.storage import get_storage_provider
import logging

logger = logging.getLogger("ap.routes.dlq")

from app.dependencies import require_admin

router = APIRouter(
    prefix="/dlq",
    tags=["Dead Letter Queue"],
    dependencies=[Depends(require_admin)]
)

@router.get("/failed-jobs", response_model=list)
def get_failed_jobs(db: Session = Depends(get_db)):
    """Retrieve all failed background tasks."""
    failed_tasks = db.query(FailedTask).order_by(FailedTask.timestamp.desc()).all()
    return [
        {
            "id": t.id,
            "task_name": t.task_name,
            "invoice_id": t.invoice_id,
            "failure_reason": t.failure_reason,
            "retry_count": t.retry_count,
            "timestamp": t.timestamp.isoformat(),
            "stack_trace": t.stack_trace
        }
        for t in failed_tasks
    ]

@router.post("/failed-jobs/{task_id}/retry", response_model=dict)
def retry_failed_job(task_id: int, db: Session = Depends(get_db)):
    """Reprocess/retry a failed job from the Dead Letter Queue."""
    failed_task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if not failed_task:
        raise HTTPException(status_code=404, detail="Failed task not found in DLQ")

    # Retrieve document / job to re-run
    # invoice_id can map to job_id or document_id. Let's look up by Job.id == failed_task.invoice_id
    job = db.query(Job).filter(Job.id == failed_task.invoice_id).first()
    if not job:
        # Fallback search by document_id
        job = db.query(Job).filter(Job.document_id == failed_task.invoice_id).first()
        
    if not job:
        raise HTTPException(status_code=404, detail="Associated processing job metadata not found")

    doc = db.query(Document).filter(Document.id == job.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Associated document file not found")

    # Dispatch back to Celery
    try:
        from app.workers.tasks import run_document_ingestion
        run_document_ingestion.delay(job.id, doc.id)
        # Delete from DLQ since retry is successfully scheduled
        db.delete(failed_task)
        db.commit()
        return {"status": "success", "message": f"Job {job.id} re-scheduled for ingestion."}
    except Exception as e:
        logger.error(f"Failed to retry job {job.id} from DLQ: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to dispatch to Celery worker: {str(e)}")

@router.delete("/failed-jobs/{task_id}", response_model=dict)
def delete_failed_job(task_id: int, db: Session = Depends(get_db)):
    """Delete a failed job record from the Dead Letter Queue."""
    failed_task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if not failed_task:
        raise HTTPException(status_code=404, detail="Failed task not found")
    
    db.delete(failed_task)
    db.commit()
    return {"status": "success", "message": "Failed task removed from DLQ"}

@router.get("/metrics", response_model=dict)
def get_dlq_metrics(db: Session = Depends(get_db)):
    """Get metrics summary for the DLQ."""
    total_failures = db.query(FailedTask).count()
    failures_by_task = db.query(FailedTask.task_name, func.count(FailedTask.id)).group_by(FailedTask.task_name).all()
    
    return {
        "total_failures": total_failures,
        "failures_by_task_type": {task: count for task, count in failures_by_task}
    }
