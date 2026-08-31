import os
import logging
import hmac
import hashlib
import json
import base64
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.ingestion.email_ingestion import EmailIngestionService

logger = logging.getLogger("webhooks.resend")

router = APIRouter(
    prefix="/webhooks",
    tags=["Resend Webhook"]
)

@router.post("/resend")
async def receive_resend_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_webhook_signature: str = Header(None)
):
    """
    Receives incoming Resend inbound email webhook events (email.received).
    Verifies HMAC signature, fetches full content using Resend API,
    and runs the same ingestion pipeline.
    """
    raw_body = await request.body()
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid or empty JSON body")

    # Signature verification (mirroring sandbox.py shape)
    secret = os.getenv("RESEND_WEBHOOK_SECRET")
    if secret:
        if not x_webhook_signature:
            raise HTTPException(status_code=401, detail="Missing X-Webhook-Signature")
            
        expected_sig = hmac.new(
            secret.encode('utf-8'),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_sig, x_webhook_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    event_type = payload.get("type")
    if event_type != "email.received":
        logger.info(f"Ignored Resend webhook event of type: {event_type}")
        return {"status": "ignored", "reason": "not_email_received"}

    data = payload.get("data", {})
    email_id = data.get("id")
    if not email_id:
        raise HTTPException(status_code=400, detail="Missing email ID in payload data")

    logger.info(f"Processing Resend inbound email webhook: {email_id}")

    resend_key = os.getenv("RESEND_API_KEY")
    email_details = {}
    
    if resend_key:
        try:
            headers = {"Authorization": f"Bearer {resend_key}"}
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(f"https://api.resend.com/emails/{email_id}", headers=headers)
                resp.raise_for_status()
                email_details = resp.json()
        except Exception as e:
            logger.error(f"Failed to fetch email details from Resend API for ID {email_id}: {e}", exc_info=True)
            
    # Fallback to webhook data if API call failed or not configured
    if not email_details:
        email_details = data

    # Instantiate EmailIngestionService to reuse its logic
    ingestion_service = EmailIngestionService(db)

    attachments = email_details.get("attachments", [])
    attachments_found = False

    for attachment in attachments:
        filename = attachment.get("filename")
        if not filename:
            continue

        # Decode base64 content
        content_b64 = attachment.get("content")
        file_bytes = None
        if content_b64:
            try:
                file_bytes = base64.b64decode(content_b64)
            except Exception as e:
                logger.error(f"Failed to decode base64 content for attachment {filename}: {e}")
                continue

        if not file_bytes:
            # Check if there is a download URL or similar
            public_url = attachment.get("public_url") or attachment.get("url")
            if public_url:
                try:
                    with httpx.Client(timeout=15.0) as client:
                        dl_resp = client.get(public_url)
                        dl_resp.raise_for_status()
                        file_bytes = dl_resp.content
                except Exception as e:
                    logger.error(f"Failed to download attachment {filename} from URL {public_url}: {e}")
                    continue

        if not file_bytes:
            continue

        attachments_found = True

        if filename.lower().endswith('.zip'):
            ingestion_service._process_zip_attachment(file_bytes, filename)
        elif filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg', '.tiff')):
            ingestion_service._ingest_file(filename, file_bytes)

    # Fallback to body processing if no attachments found
    if not attachments_found:
        body_content = email_details.get("html") or email_details.get("text") or ""
        if body_content.strip():
            ext = ".html" if email_details.get("html") else ".txt"
            fallback_filename = f"resend_body_{email_id[:8]}{ext}"
            ingestion_service._ingest_file(fallback_filename, body_content.encode('utf-8'))

    return {"status": "success", "email_id": email_id}
