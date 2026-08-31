"""Webhook Event Dispatcher."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.settings import Settings
from app.webhooks.schemas import CanonicalWebhookEvent, WebhookActor

class WebhookDispatcher:
    """
    Constructs the canonical event payload and dispatches it asynchronously via Celery.
    """

    @staticmethod
    def trigger(
        db: Session,
        event_type: str,
        invoice_id: int,
        tenant_id: str,
        actor_id: Optional[str] = None,
        actor_name: Optional[str] = None,
        actor_role: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ):
        """
        Builds the canonical event and enqueues the celery task if webhooks are enabled
        for this tenant and event type.
        """
        # 1. Check if webhooks are enabled and event is subscribed
        settings = db.query(Settings).first()
        if not settings or not settings.webhook_enabled:
            return
            
        if event_type not in settings.webhook_events:
            return
            
        # 2. Build Event
        event_id = f"evt_{uuid.uuid4().hex}"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        actor = None
        if actor_id or actor_name:
            actor = WebhookActor(id=actor_id, role=actor_role, name=actor_name)
            
        event = CanonicalWebhookEvent(
            event_id=event_id,
            event_type=event_type,
            timestamp=timestamp,
            tenant_id=str(tenant_id),
            invoice_id=str(invoice_id),
            actor=actor,
            data=data or {}
        )
        
        # 3. Enqueue Celery Task
        from app.workers.tasks import dispatch_webhook_task
        dispatch_webhook_task.delay(
            tenant_id=str(tenant_id),
            event_id=event.event_id,
            event_type=event.event_type,
            payload=event.model_dump(mode="json")
        )
