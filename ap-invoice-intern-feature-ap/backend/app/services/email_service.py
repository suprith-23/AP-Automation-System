import os
import logging
import httpx

logger = logging.getLogger("email_service")

class EmailService:
    @staticmethod
    def get_otp_html(otp_code: str, action: str) -> str:
        """Renders the HTML template for OTP verification."""
        action_name = action.replace('_', ' ')
        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px; color: #1f2937;">
                <div style="max-width: 500px; margin: 0 auto; padding: 30px; border-radius: 12px; border: 1px solid #e4e4e7; background: white;">
                    <h2 style="color: #10b981; margin-top: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">AP Autoflow</h2>
                    <p style="font-size: 14px; line-height: 1.5;">You requested a verification code for <strong>{action_name}</strong>.</p>
                    <div style="margin: 24px 0; text-align: center;">
                        <span style="font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #111827; background-color: #f3f4f6; padding: 10px 24px; border-radius: 8px; display: inline-block;">{otp_code}</span>
                    </div>
                    <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">This code is valid for <strong>5 minutes</strong>. If you did not request this code, please ignore this email.</p>
                </div>
            </body>
        </html>
        """

    @staticmethod
    def get_admin_notification_html(org_name: str, user_name: str, user_email: str) -> str:
        """Renders the HTML template for Admin pending user notifications."""
        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px; color: #1f2937;">
                <div style="max-width: 500px; margin: 0 auto; padding: 30px; border-radius: 12px; border: 1px solid #e4e4e7; background: white;">
                    <h2 style="color: #10b981; margin-top: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">AP Autoflow</h2>
                    <p style="font-size: 14px; line-height: 1.5;">A new user has requested access to your organization <strong>{org_name}</strong>.</p>
                    <div style="margin: 20px 0; padding: 15px; background-color: #f9fafb; border-radius: 8px; font-size: 13px;">
                        <p style="margin: 4px 0;"><strong>Name:</strong> {user_name}</p>
                        <p style="margin: 4px 0;"><strong>Email:</strong> {user_email}</p>
                    </div>
                    <p style="font-size: 13px; line-height: 1.5;">Please log in to the AP Automation Admin Dashboard to approve or reject this request.</p>
                </div>
            </body>
        </html>
        """

    @staticmethod
    def get_user_rejection_html(user_name: str) -> str:
        """Renders the HTML template for user registration rejection."""
        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px; color: #1f2937;">
                <div style="max-width: 500px; margin: 0 auto; padding: 30px; border-radius: 12px; border: 1px solid #e4e4e7; background: white;">
                    <h2 style="color: #ef4444; margin-top: 0; font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">AP Autoflow</h2>
                    <p style="font-size: 14px; line-height: 1.5;">Dear {user_name},</p>
                    <p style="font-size: 14px; line-height: 1.5;">We regret to inform you that your request to join your organization has been rejected by the administrator.</p>
                    <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">If you believe this was an error, please contact your organization administrator.</p>
                </div>
            </body>
        </html>
        """

    @classmethod
    def send_email(cls, to: str, subject: str, html: str) -> bool:
        """Sends an email using Resend API (HTTP client direct integration)."""
        api_key = os.getenv("RESEND_API_KEY")
        sender = os.getenv("RESEND_SENDER_EMAIL", "no-reply@ap-autoflow.com")

        if not api_key:
            logger.warning(f"RESEND_API_KEY not configured. Simulated sending to {to}: {subject}")
            print(f"[RESEND-DEBUG] Email to: {to}, Subject: {subject}", flush=True)
            return True

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": sender,
            "to": [to],
            "subject": subject,
            "html": html
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post("https://api.resend.com/emails", json=payload, headers=headers)
                if resp.status_code in [200, 201, 202]:
                    logger.info(f"Successfully sent email to {to} via Resend")
                    return True
                else:
                    logger.error(f"Resend API error: Status {resp.status_code}, Body: {resp.text}")
                    return False
        except Exception as e:
            logger.exception(f"Exception raised while sending email via Resend to {to}: {e}")
            return False
