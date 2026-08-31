import imaplib
import email
import logging
import os
from typing import Optional
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.ingestion.orchestrator import PipelineOrchestrator
from app.models.document import Document
from app.models.job import Job
import uuid
from datetime import datetime

logger = logging.getLogger("ingestion.email")

class EmailIngestionService:
    def __init__(self, db: Session):
        self.db = db
        self.imap_server = os.getenv("IMAP_SERVER", "imap.company.local")
        self.imap_port = int(os.getenv("IMAP_PORT", "993"))
        self.imap_user = os.getenv("IMAP_USER", "ap-invoices@company.com")
        self.imap_pass = os.getenv("IMAP_PASSWORD", "mock_pass")
        self.imap_use_ssl = os.getenv("IMAP_USE_SSL", "true").lower() in ("true", "1", "yes")

    def poll_mailbox(self):
        """
        Polls configured IMAP mailbox for unread emails, parses PDF attachments,
        saves them to local storage, and kicks off the AP automation pipeline.
        """
        logger.info(f"Polling mailbox {self.imap_user} on {self.imap_server}:{self.imap_port} (SSL: {self.imap_use_ssl})...")
        try:
            # We mock the actual IMAP connection/auth to prevent runtime crashes when offline/in tests
            # but provide standard IMAP scraper code structure.
            if self.imap_pass == "mock_pass":
                logger.info("Email ingestion running in mock/demo mode. No actual IMAP server configured.")
                return

            if self.imap_use_ssl:
                mail = imaplib.IMAP4_SSL(self.imap_server, self.imap_port)
            else:
                mail = imaplib.IMAP4(self.imap_server, self.imap_port)
            mail.login(self.imap_user, self.imap_pass)
            mail.select("inbox")
            
            status, messages = mail.search(None, 'UNSEEN')
            if status != "OK":
                return
                
            for num in messages[0].split():
                # Mark as seen immediately so concurrent polling doesn't duplicate
                mail.store(num, '+FLAGS', '\\Seen')
                
                status, data = mail.fetch(num, '(RFC822)')
                if status != "OK":
                    continue
                    
                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)
                parse_and_ingest_mime_email(self.db, msg)
                        
            mail.close()
            mail.logout()
        except Exception as e:
            logger.error(f"Email polling failed: {e}", exc_info=True)


def ingest_document(db: Session, filename: str, file_bytes: bytes, organization_id: Optional[str] = None) -> Document:
    from app.ingestion.storage import get_storage_provider
    storage_provider = get_storage_provider()
    storage_path = storage_provider.save(file_bytes, filename)
    
    ext = filename.lower().rsplit(".", 1)[-1]
    mime_map = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "tiff": "image/tiff",
        "tif": "image/tiff",
        "html": "text/html",
        "txt": "text/plain"
    }
    content_type = mime_map.get(ext, "application/octet-stream")
    
    doc = Document(
        filename=filename,
        storage_path=storage_path,
        file_size=len(file_bytes),
        content_type=content_type,
        uploaded_at=datetime.utcnow(),
        status="uploaded"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # Create Job metadata
    job_id = str(uuid.uuid4())
    stages_metadata = {}
    if organization_id:
        stages_metadata["organization_id"] = str(organization_id)
    stages_metadata["source_type"] = "email"
        
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
    except Exception as e:
        logger.warning(f"Could not dispatch to Celery from email ingestion. Falling back to sync run. Detail: {e}")
        # Fallback to sync run if Celery offline
        orchestrator = PipelineOrchestrator(db)
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        if loop.is_running():
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(lambda: asyncio.new_event_loop().run_until_complete(
                    orchestrator.run_pipeline(job_id, file_bytes, filename)
                ))
                future.result()
        else:
            loop.run_until_complete(orchestrator.run_pipeline(job_id, file_bytes, filename))
    return doc


def process_zip_attachment(db: Session, zip_bytes: bytes, filename: str, organization_id: Optional[str] = None):
    import zipfile
    import io
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
            for file_info in z.infolist():
                if file_info.is_dir():
                    continue
                
                if file_info.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.html', '.txt')):
                    nested_bytes = z.read(file_info.filename)
                    clean_filename = os.path.basename(file_info.filename)
                    ingest_document(db, clean_filename, nested_bytes, organization_id)
    except Exception as e:
        logger.error(f"Error reading zip attachment {filename}: {e}", exc_info=True)


def parse_and_ingest_mime_email(db: Session, msg: email.message.Message):
    import email.utils
    from app.models.organization import Organization

    # Parse recipient (To header) to identify the tenant
    to_header = msg.get("To", "")
    _, email_address = email.utils.parseaddr(to_header)
    
    org_id = None
    if email_address:
        local_part = email_address.split("@")[0].lower()
        # Handle subaddressing (e.g. invoices+beverly@company-ap.com)
        if "+" in local_part:
            local_part = local_part.split("+")[-1]
            
        org = db.query(Organization).filter(Organization.code.ilike(local_part)).first()
        if org:
            org_id = org.id
            logger.info(f"Resolved email recipient '{email_address}' to organization: {org.name} ({org_id})")

    # Fallback: Parse subject line to identify the tenant (e.g. "Invoice for Beverly")
    if not org_id:
        subject = msg.get("Subject", "").lower()
        orgs = db.query(Organization).all()
        for org in orgs:
            if org.code.lower() in subject:
                org_id = org.id
                logger.info(f"Resolved email subject '{subject}' to organization: {org.name} ({org_id})")
                break

    attachments_found = False
    
    # Check attachments
    for part in msg.walk():
        if part.get_content_maintype() == 'multipart':
            continue
        if part.get('Content-Disposition') is None:
            continue
            
        filename = part.get_filename()
        if not filename:
            continue
            
        file_bytes = part.get_payload(decode=True)
        if not file_bytes:
            continue
            
        attachments_found = True
        
        if filename.lower().endswith('.zip'):
            process_zip_attachment(db, file_bytes, filename, org_id)
        elif filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg', '.tiff')):
            ingest_document(db, filename, file_bytes, org_id)
    
    # Fallback if no attachments found
    if not attachments_found:
        body_content = ""
        body_type = "text/plain"
        
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disp = str(part.get('Content-Disposition'))
                
                if content_type in ["text/plain", "text/html"] and "attachment" not in content_disp:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_content = payload.decode(part.get_content_charset() or 'utf-8', errors='ignore')
                        body_type = content_type
                        if content_type == "text/html":
                            break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body_content = payload.decode(msg.get_content_charset() or 'utf-8', errors='ignore')
                body_type = msg.get_content_type()
                
        if body_content.strip():
            ext = ".html" if body_type == "text/html" else ".txt"
            fallback_filename = f"body_invoice_{uuid.uuid4().hex[:8]}{ext}"
            ingest_document(db, fallback_filename, body_content.encode('utf-8'), org_id)

