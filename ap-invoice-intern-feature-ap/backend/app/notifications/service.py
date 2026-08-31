"""Notification Service for Human Alerts."""
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.settings import Settings

class NotificationService:
    """
    Handles formatting and dispatching human-readable alerts to notification providers (Discord, Email).
    Cleanly separated from the machine-to-machine Webhook integration.
    """

    @staticmethod
    def notify(
        db: Session,
        event_type: str,
        invoice_id: int,
        tenant_id: str,
        message: str,
        severity: str = "INFO",
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Dispatches a notification if the tenant is subscribed to this event_type.
        """
        import uuid
        org_uuid = None
        if tenant_id and tenant_id != "global":
            try:
                org_uuid = uuid.UUID(tenant_id)
            except ValueError:
                pass

        settings = Settings.get_for_organization(db, org_uuid)
        if not settings:
            return
            
        # Bypass subscription check for INVOICE_RECEIVED to ensure it is always delivered if webhook is configured
        if event_type != "INVOICE_RECEIVED" and event_type not in settings.notification_events:
            return
            
        import os
        discord_webhook_url = settings.discord_webhook_url or os.getenv("DISCORD_WEBHOOK_URL")
        if discord_webhook_url:
            from app.workers.tasks import dispatch_notification_task
            dispatch_notification_task.delay(
                tenant_id=str(tenant_id),
                event_type=event_type,
                invoice_id=str(invoice_id),
                message=message,
                severity=severity,
                metadata=metadata or {}
            )
