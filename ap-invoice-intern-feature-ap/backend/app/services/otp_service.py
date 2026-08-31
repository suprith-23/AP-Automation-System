import os
import random
import string
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import httpx

from app.models.otp_verification import OTPVerification

logger = logging.getLogger(__name__)

class OTPService:
    @staticmethod
    def generate_otp(length: int = 6) -> str:
        """Generates a secure numeric OTP."""
        return "".join(random.choices(string.digits, k=length))

    @staticmethod
    def send_otp_via_brevo(email: str, otp_code: str, action: str) -> bool:
        """Sends OTP to the user's email using Resend Service."""
        from app.services.email_service import EmailService
        subject = f"Verification Code: {otp_code} - AP Autoflow"
        html_content = EmailService.get_otp_html(otp_code, action)
        return EmailService.send_email(email, subject, html_content)

    @staticmethod
    def send_notification_to_admin(admin_email: str, user_name: str, user_email: str, org_name: str) -> bool:
        """Notifies organization admin of a pending registration request using Resend Service."""
        from app.services.email_service import EmailService
        subject = f"Pending Registration Request - {user_name} - AP Autoflow"
        html_content = EmailService.get_admin_notification_html(org_name, user_name, user_email)
        return EmailService.send_email(admin_email, subject, html_content)

    @staticmethod
    def create_and_send_otp(db: Session, email: str, action: str) -> dict:
        """Generates, saves, and sends an OTP, checking the 60 seconds resend limit."""
        # 1. Check for resend limit (60s)
        one_minute_ago = datetime.utcnow() - timedelta(seconds=60)
        recent_otp = db.query(OTPVerification).filter(
            OTPVerification.email == email,
            OTPVerification.action == action,
            OTPVerification.created_at >= one_minute_ago,
            OTPVerification.is_used == False
        ).first()

        if recent_otp:
            time_left = int(60 - (datetime.utcnow() - recent_otp.created_at).total_seconds())
            return {"status": "error", "message": f"Please wait {time_left} seconds before requesting a new OTP."}

        # 2. Generate and store
        otp_code = OTPService.generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=5)

        # Deactivate any previous unused OTPs for this action/email
        db.query(OTPVerification).filter(
            OTPVerification.email == email,
            OTPVerification.action == action,
            OTPVerification.is_used == False
        ).update({"is_used": True})

        db_otp = OTPVerification(
            email=email,
            otp_code=otp_code,
            action=action,
            expires_at=expires_at,
            attempts=0,
            is_used=False
        )
        db.add(db_otp)
        db.commit()

        # 3. Send
        sent = OTPService.send_otp_via_brevo(email, otp_code, action)
        if sent:
            return {"status": "success", "message": "OTP sent successfully."}
        else:
            return {"status": "error", "message": "Failed to send OTP email."}

    @staticmethod
    def verify_otp(db: Session, email: str, action: str, otp_code: str) -> dict:
        """Verifies the OTP code for the given action and email."""
        db_otp = db.query(OTPVerification).filter(
            OTPVerification.email == email,
            OTPVerification.action == action,
            OTPVerification.is_used == False
        ).order_by(OTPVerification.created_at.desc()).first()

        if not db_otp:
            return {"status": "error", "message": "No active verification code found."}

        # Check maximum verification attempts (3)
        if db_otp.attempts >= 3:
            db_otp.is_used = True
            db.commit()
            return {"status": "error", "message": "Maximum verification attempts exceeded. Please request a new OTP."}

        # Increment attempts
        db_otp.attempts += 1
        db.commit()

        # Check expiry
        if db_otp.expires_at < datetime.utcnow():
            db_otp.is_used = True
            db.commit()
            return {"status": "error", "message": "Verification code has expired. Please request a new OTP."}

        # Compare code
        if db_otp.otp_code != otp_code:
            db.commit()
            return {"status": "error", "message": f"Incorrect verification code. {3 - db_otp.attempts} attempts remaining."}

        # Success! Mark as used
        db_otp.is_used = True
        db.commit()
        return {"status": "success", "message": "OTP verified successfully."}
