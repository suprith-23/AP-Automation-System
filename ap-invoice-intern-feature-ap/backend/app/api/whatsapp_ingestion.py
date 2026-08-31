import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document
from app.models.job import Job
from app.ingestion.storage import get_storage_provider

logger = logging.getLogger("ingestion.whatsapp")

router = APIRouter(
    prefix="/whatsapp",
    tags=["WhatsApp Ingestion"]
)

@router.get("/webhook")
def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: int = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token")
):
    """
    WhatsApp webhook verification endpoint (Meta developers validation handshake).
    """
    import os
    verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "ap_whatsapp_verify_token_123")
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("WhatsApp webhook verified successfully.")
        return hub_challenge
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives incoming WhatsApp message payload events.
    Parses media link (invoice PDFs/images), downloads them, and schedules ingestion jobs.
    """
    import os
    import hmac
    import hashlib
    
    body = await request.body()
    import json as json_lib
    try:
        payload = await request.json()
    except json_lib.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid or empty JSON body")
    
    app_secret = os.getenv("WHATSAPP_APP_SECRET")
    is_testing = os.getenv("TESTING") == "True"
    if app_secret and not is_testing:
        signature = request.headers.get("X-Hub-Signature-256", "")
        if not signature.startswith("sha256="):
            raise HTTPException(status_code=403, detail="Invalid signature format")
        
        expected_sig = hmac.new(
            app_secret.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(f"sha256={expected_sig}", signature):
            raise HTTPException(status_code=403, detail="Signature mismatch")
            
    logger.info(f"Received WhatsApp webhook event: {payload}")
    
    # Extract entry data (Meta Cloud API payload structure)
    try:
        entries = payload.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                messages = value.get("messages", [])
                for msg in messages:
                    # Check if message contains media/document attachment
                    if msg.get("type") == "document":
                        doc_info = msg.get("document", {})
                        media_id = doc_info.get("id")
                        filename = doc_info.get("filename", "whatsapp_invoice.pdf")
                        mime_type = doc_info.get("mime_type", "application/pdf")
                        import httpx
                        whatsapp_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
                        api_version = os.getenv("WHATSAPP_API_VERSION", "v20.0")
                        file_bytes = None
                        if whatsapp_token and media_id:
                            try:
                                headers = {"Authorization": f"Bearer {whatsapp_token}"}
                                with httpx.Client(timeout=15.0) as client:
                                    # 1. Get media details to retrieve download URL
                                    media_resp = client.get(f"https://graph.facebook.com/{api_version}/{media_id}", headers=headers)
                                    media_resp.raise_for_status()
                                    download_url = media_resp.json().get("url")
                                    if download_url:
                                        # 2. Download binary content
                                        download_resp = client.get(download_url, headers=headers)
                                        download_resp.raise_for_status()
                                        file_bytes = download_resp.content
                            except Exception as e:
                                logger.error(f"Failed to download WhatsApp media {media_id} via API: {e}", exc_info=True)
                                raise HTTPException(status_code=502, detail=f"Failed to download WhatsApp media: {e}")
                        else:
                            raise HTTPException(status_code=400, detail="WHATSAPP_ACCESS_TOKEN or media ID missing")
                            
                        storage_provider = get_storage_provider()
                        storage_path = storage_provider.save(file_bytes, filename)
                        
                        doc = Document(
                            filename=filename,
                            storage_path=storage_path,
                            file_size=len(file_bytes),
                            content_type=mime_type,
                            uploaded_at=datetime.utcnow(),
                            status="uploaded"
                        )
                        db.add(doc)
                        db.commit()
                        db.refresh(doc)
                        
                        job_id = str(uuid.uuid4())
                        stages_metadata = {"source_type": "whatsapp"}
                        job = Job(
                            id=job_id,
                            document_id=doc.id,
                            status="pending",
                            current_stage="OCR",
                            retry_count=0,
                            stages_metadata=stages_metadata
                        )
                        db.add(job)
                        db.commit()
                        
                        try:
                            from app.workers.tasks import run_document_ingestion
                            run_document_ingestion.delay(job_id, doc.id)
                        except Exception:
                            # Fallback if Celery down
                            from app.ingestion.orchestrator import PipelineOrchestrator
                            orchestrator = PipelineOrchestrator(db)
                            import asyncio
                            loop = asyncio.get_event_loop()
                            loop.run_until_complete(orchestrator.run_pipeline(job_id, file_bytes, filename))
                            
                        return {"status": "success", "job_id": job_id, "document_id": doc.id}
    except Exception as e:
        logger.error(f"Error parsing WhatsApp webhook message: {e}", exc_info=True)
        
    return {"status": "ignored"}
