import smtplib
import imaplib
import email
import os
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.document import Document
from app.models.job import Job
from app.ingestion.storage import LocalStorageProvider
from app.ingestion.orchestrator import PipelineOrchestrator
from app.core.database import SessionLocal

class GmailService:
    @staticmethod
    def send_notification(to_email: str, subject: str, body_html: str) -> bool:
        """Sends an email notification via Gmail SMTP."""
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")

        if not smtp_user or not smtp_password:
            print("SMTP configuration missing. Skipping email dispatch.")
            return False

        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_html, 'html'))

        try:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_email, msg.as_string())
            server.quit()
            return True
        except Exception as e:
            print(f"Error sending email: {e}")
            return False

    @staticmethod
    async def fetch_and_ingest_invoices(db: Session, background_tasks) -> dict:
        """Connects to Gmail via IMAP, pulls PDF invoice attachments, and triggers the orchestrator."""
        imap_host = os.getenv("IMAP_HOST", "imap.gmail.com")
        imap_user = os.getenv("SMTP_USER", "")  # Uses same user email
        imap_password = os.getenv("SMTP_PASSWORD", "")  # Uses same App Password

        if not imap_user or not imap_password:
            return {"status": "error", "message": "Gmail credentials not configured."}

        try:
            # Connect to Gmail IMAP
            mail = imaplib.IMAP4_SSL(imap_host)
            mail.login(imap_user, imap_password)
            mail.select("inbox")

            # Search for unread emails containing "invoice" in the subject or body
            status, messages = mail.search(None, '(UNSEEN)')
            if status != "OK":
                return {"status": "success", "message": "No new emails found.", "ingested_count": 0}

            email_ids = messages[0].split()
            ingested_count = 0
            storage_provider = LocalStorageProvider()

            for mail_id in email_ids:
                status, data = mail.fetch(mail_id, "(RFC822)")
                if status != "OK":
                    continue

                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)

                # Process attachments
                for part in msg.walk():
                    if part.get_content_maintype() == 'multipart':
                        continue
                    if part.get('Content-Disposition') is None:
                        continue

                    filename = part.get_filename()
                    if filename and filename.lower().endswith('.pdf'):
                        file_bytes = part.get_payload(decode=True)
                        if not file_bytes:
                            continue

                        # Save attachment
                        storage_path = storage_provider.save(file_bytes, filename)

                        # Create Document metadata
                        doc = Document(
                            filename=filename,
                            storage_path=storage_path,
                            file_size=len(file_bytes),
                            content_type="application/pdf",
                            uploaded_at=datetime.utcnow(),
                            status="uploaded"
                        )
                        db.add(doc)
                        db.commit()
                        db.refresh(doc)

                        # Create Job metadata
                        job_id = str(uuid.uuid4())
                        job = Job(
                            id=job_id,
                            document_id=doc.id,
                            status="pending",
                            current_stage="OCR",
                            retry_count=0
                        )
                        db.add(job)
                        db.commit()

                        # Run orchestrator in background
                        from app.api.ingestion_routes import run_orchestration_background
                        background_tasks.add_task(
                            run_orchestration_background,
                            job_id,
                            file_bytes,
                            filename,
                            SessionLocal
                        )

                        ingested_count += 1

                # Mark email as read
                mail.store(mail_id, '+FLAGS', '\\Seen')

            mail.close()
            mail.logout()

            return {
                "status": "success",
                "message": f"Successfully checked inbox. Ingested {ingested_count} invoices.",
                "ingested_count": ingested_count
            }

        except Exception as e:
            print(f"IMAP Sync failed: {e}")
            return {"status": "error", "message": f"Sync failed: {str(e)}"}
