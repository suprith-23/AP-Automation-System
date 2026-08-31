"""Notification Service definitions for the Workflow Engine."""
from abc import ABC, abstractmethod
import logging
import os
import smtplib
from email.mime.text import MIMEText
import httpx

logger = logging.getLogger("workflow.notification")

class NotificationService(ABC):
    @abstractmethod
    def send_notification(self, invoice_id: int, message: str, level: str = "info") -> None:
        """Sends workflow related notifications to actors or external systems."""
        pass

class ConsoleNotificationService(NotificationService):
    def send_notification(self, invoice_id: int, message: str, level: str = "info") -> None:
        logger.info(f"[NOTIFICATION - {level.upper()}] Invoice {invoice_id}: {message}")

class EmailNotificationService(NotificationService):
    """
    Sends SMTP email notifications.
    Falls back to ConsoleNotificationService if SMTP server details are not configured.
    """
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_pass = os.getenv("SMTP_PASSWORD")
        self.sender_email = os.getenv("SENDER_EMAIL", "ap-alerts@company.com")
        self.recipient_email = os.getenv("AP_MANAGER_EMAIL", "ap-manager@company.com")
        
        self.is_configured = bool(self.smtp_host and self.smtp_user and self.smtp_pass)
        
        # Fail loudly in staging or production if SMTP configuration is missing
        app_env = os.getenv("APP_ENV", "development").lower()
        if app_env in ("production", "staging") and not self.is_configured:
            raise RuntimeError(f"SMTP configuration is missing or incomplete (APP_ENV={app_env}). SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be set.")

    def send_notification(self, invoice_id: int, message: str, level: str = "info") -> None:
        if not self.is_configured:
            logger.info(f"[EMAIL MOCK - {level.upper()}] Invoice {invoice_id}: {message}")
            return
            
        try:
            subject = f"[{level.upper()}] AP Invoice Alert: #{invoice_id}"
            msg = MIMEText(message)
            msg["Subject"] = subject
            msg["From"] = self.sender_email
            msg["To"] = self.recipient_email
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_pass)
                server.sendmail(self.sender_email, [self.recipient_email], msg.as_string())
            logger.info(f"Email alert sent successfully for invoice #{invoice_id}")
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")

class SMSNotificationService(NotificationService):
    """
    Sends SMS notifications via Twilio API.
    Falls back to ConsoleNotificationService if Twilio credentials are not configured.
    """
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_number = os.getenv("TWILIO_NUMBER")
        self.recipient_phone = os.getenv("AP_MANAGER_PHONE", "+15550100")
        
        self.is_configured = bool(self.account_sid and self.auth_token and self.twilio_number)

    def send_notification(self, invoice_id: int, message: str, level: str = "info") -> None:
        if not self.is_configured:
            logger.info(f"[SMS MOCK - {level.upper()}] Invoice {invoice_id}: {message}")
            return
            
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
            data = {
                "From": self.twilio_number,
                "To": self.recipient_phone,
                "Body": f"[{level.upper()}] AP Invoice Alert #{invoice_id}: {message}"
            }
            # Sending HTTP Basic Auth post using httpx
            with httpx.Client() as client:
                res = client.post(
                    url,
                    data=data,
                    auth=(self.account_sid, self.auth_token),
                    timeout=5.0
                )
                res.raise_for_status()
            logger.info(f"SMS alert sent successfully for invoice #{invoice_id}")
        except Exception as e:
            logger.error(f"Failed to send SMS alert: {e}")
