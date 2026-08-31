import os
import uuid
import logging
import base64
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.ingestion.email_ingestion import ingest_document, process_zip_attachment

logger = logging.getLogger("webhooks.brevo")

router = APIRouter(
    prefix="/webhooks",
    tags=["Brevo Webhook"]
)

@router.post("/brevo")
async def receive_brevo_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_webhook_token: str = Header(None, alias="X-Webhook-Token"),
    token: str = Query(None)
):
    """
    Receives incoming Brevo inbound email webhook events.
    Verifies token, decodes base64 attachments, and runs document ingestion.
    """
    expected_token = os.getenv("BREVO_INBOUND_WEBHOOK_TOKEN")
    
    # Verify token
    provided_token = x_webhook_token or token
    if expected_token and provided_token != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized: Webhook token mismatch")
        
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    logger.info(f"Received Brevo inbound email webhook: {payload}")
    
    attachments = payload.get("Attachments", payload.get("attachments", []))
    processed_count = 0
    
    # Process attachments
    for att in attachments:
        # Support various casing/keys
        name = att.get("Name") or att.get("name") or "attachment"
        content_b64 = att.get("Content") or att.get("content")
        
        if not content_b64:
            logger.warning(f"Attachment {name} has no base64 content key. Skipping.")
            continue
            
        try:
            # Decode base64 content
            file_bytes = base64.b64decode(content_b64)
        except Exception as e:
            logger.error(f"Failed to decode base64 for attachment {name}: {e}")
            continue
            
        if name.lower().endswith('.zip'):
            process_zip_attachment(db, file_bytes, name)
        elif name.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg', '.tiff')):
            ingest_document(db, name, file_bytes)
        processed_count += 1
        
    # If no attachments, fall back to parsing Text/Html body as a document
    if processed_count == 0:
        body_content = payload.get("Text") or payload.get("text") or payload.get("Html") or payload.get("html") or ""
        if body_content.strip():
            is_html = "Html" in payload or "html" in payload or (payload.get("text") is None and payload.get("Text") is None and "<div" in body_content)
            ext = ".html" if is_html else ".txt"
            fallback_filename = f"body_invoice_{uuid.uuid4().hex[:8]}{ext}"
            ingest_document(db, fallback_filename, body_content.encode('utf-8'))
            processed_count += 1

    return {"status": "success", "processed_attachments": processed_count}
