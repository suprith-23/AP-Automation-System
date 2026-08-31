"""FastAPI routing endpoints for Document Ingestion and Job tracking."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document
from app.models.job import Job
from app.ingestion.storage import get_storage_provider
import uuid
from datetime import datetime

from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    tags=["Ingestion"],
    dependencies=[Depends(get_current_user)]
)

storage_provider = get_storage_provider()

async def run_orchestration_background(job_id: str, file_bytes: bytes, filename: str, db_session_factory):
    from app.ingestion.orchestrator import PipelineOrchestrator
    db = db_session_factory()
    try:
        orchestrator = PipelineOrchestrator(db)
        await orchestrator.run_pipeline(job_id, file_bytes, filename)
    finally:
        db.close()

@router.post("/documents/upload", response_model=dict)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    prompt_version: str = None,
    db: Session = Depends(get_db)
):
    """
    Accepts file uploads, persists them to abstract storage, creates job records,
    and runs the AP orchestrator inside FastAPI BackgroundTasks.
    """
    file_bytes = await file.read()
    
    from app.services.ingestion_orchestrator import IngestionOrchestrator
    try:
        IngestionOrchestrator.validate_file_size_and_type(file_bytes, file.filename)
    except HTTPException as e:
        raise e
        
    # Persist file
    storage_path = storage_provider.save(file_bytes, file.filename)
    
    # Create Document metadata
    doc = Document(
        filename=file.filename,
        storage_path=storage_path,
        file_size=len(file_bytes),
        content_type=file.content_type or "application/octet-stream",
        uploaded_at=datetime.utcnow(),
        status="uploaded"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # Create Job metadata
    job_id = str(uuid.uuid4())
    stages_metadata = {}
    if prompt_version:
        stages_metadata["requested_prompt_version"] = prompt_version
    stages_metadata["uploaded_at"] = datetime.utcnow().isoformat()
    stages_metadata["source_type"] = "admin_upload"
    job = Job(
        id=job_id,
        document_id=doc.id,
        status="queued",
        current_stage="INGESTION",
        retry_count=0,
        stages_metadata=stages_metadata
    )
    db.add(job)
    db.commit()
    
    # Run async background pipeline task via Celery with local fallback
    from app.core.database import SessionLocal
    import logging
    logger = logging.getLogger("ingestion.routes")
    try:
        from app.workers.tasks import run_document_ingestion
        run_document_ingestion.delay(job_id, doc.id)
        logger.info(f"Ingestion job {job_id} dispatched to Celery background worker successfully.")
    except Exception as e:
        logger.warning(f"Could not dispatch to Celery. Falling back to local BackgroundTasks. Detail: {e}")
        background_tasks.add_task(
            run_orchestration_background,
            job_id,
            file_bytes,
            file.filename,
            SessionLocal
        )
    
    return {
        "message": "Document uploaded successfully. Processing started.",
        "document_id": doc.id,
        "job_id": job_id,
        "status": "queued"
    }

@router.get("/jobs/{job_id}", response_model=dict)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Retrieves current execution status of a processing job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return {
        "job_id": job.id,
        "document_id": job.document_id,
        "status": job.status,
        "current_stage": job.current_stage,
        "retry_count": job.retry_count,
        "error_message": job.error_message,
        "stages_metadata": job.stages_metadata,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat()
    }

@router.get("/documents/{document_id}", response_model=dict)
def get_document_details(document_id: int, db: Session = Depends(get_db)):
    """Retrieves document file metadata attributes."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {
        "document_id": doc.id,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "content_type": doc.content_type,
        "uploaded_at": doc.uploaded_at.isoformat(),
        "status": doc.status
    }

@router.delete("/documents/{document_id}", response_model=dict)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"]))
):
    """Deletes the document record and removes physical files from storage."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Delete file
    try:
        storage_provider.delete(doc.storage_path)
    except Exception:
        pass
        
    # Delete related jobs
    db.query(Job).filter(Job.document_id == document_id).delete()
    
    db.delete(doc)
    db.commit()
    
    return {
        "message": f"Document {document_id} and related jobs deleted successfully."
    }

from fastapi.responses import StreamingResponse
import io

@router.get("/documents/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Downloads the original document file binary stream."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    try:
        file_bytes = storage_provider.get(doc.storage_path)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Failed to retrieve file: {str(e)}")
        
    media_type = doc.content_type or "application/octet-stream"
    # Detect correct MIME type from filename extension (content_type may be incorrect)
    ext = (doc.filename or "").lower().rsplit(".", 1)[-1]
    ext_mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "pdf": "application/pdf", "tiff": "image/tiff", "tif": "image/tiff"}
    if ext in ext_mime_map:
        media_type = ext_mime_map[ext]
    # Clean filename of carriage returns or special characters for header safety
    safe_filename = doc.filename.replace("\r", "").replace("\n", "")
    headers = {"Content-Disposition": f'attachment; filename="{safe_filename}"'}
    return StreamingResponse(io.BytesIO(file_bytes), media_type=media_type, headers=headers)


@router.get("/documents/{document_id}/preview")
def preview_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Serves the document file inline for browser preview (not as download)."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    try:
        file_bytes = storage_provider.get(doc.storage_path)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Failed to retrieve file: {str(e)}")
        
    # Detect correct MIME type from filename extension
    ext = (doc.filename or "").lower().rsplit(".", 1)[-1]
    ext_mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "pdf": "application/pdf", "tiff": "image/tiff", "tif": "image/tiff"}
    media_type = ext_mime_map.get(ext, doc.content_type or "application/octet-stream")
    safe_filename = doc.filename.replace("\r", "").replace("\n", "")
    # inline = browser renders it instead of downloading
    headers = {
        "Content-Disposition": f'inline; filename="{safe_filename}"',
        "Cache-Control": "private, max-age=3600"
    }
    return StreamingResponse(io.BytesIO(file_bytes), media_type=media_type, headers=headers)

@router.post("/documents/gmail-sync", response_model=dict)
async def sync_gmail_inbox(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Connects to the configured Gmail inbox, fetches unread emails with PDF attachments,
    saves them to storage, and queues them for OCR pipeline processing.
    """
    from app.services.gmail_service import GmailService
    result = await GmailService.fetch_and_ingest_invoices(db, background_tasks)
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result
