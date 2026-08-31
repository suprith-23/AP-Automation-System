"""Internal Webhook Sandbox & Test Console APIs."""
import hmac
import hashlib
import json
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies import require_admin
from app.models.settings import Settings
from app.models.webhook_delivery import WebhookDelivery

router = APIRouter(
    prefix="/webhooks",
    tags=["Webhook Sandbox"],
)

@router.post("/sandbox")
async def receive_webhook_sandbox(
    request: Request,
    db: Session = Depends(get_db),
    x_webhook_signature: str = Header(None)
):
    """
    Simulates an external consumer receiving a webhook.
    Validates HMAC-SHA256 signature and records receipt.
    """
    raw_body = await request.body()
    try:
        body_json = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid or empty JSON body")
    
    # In a real external app, they would have a copy of the secret.
    # For sandbox, we use the tenant's configured secret to verify it mathematically matches.
    settings = db.query(Settings).first()
    secret = settings.webhook_secret if settings else ""
    
    if not secret:
        # If no secret configured but they hit sandbox, just accept it for testing
        pass
    else:
        # Validate HMAC
        if not x_webhook_signature:
            raise HTTPException(status_code=401, detail="Missing X-Webhook-Signature")
            
        expected_sig = hmac.new(
            secret.encode('utf-8'),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_sig, x_webhook_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    # In a real app, you would process the event here.
    # For the sandbox, we simply return 200 OK to signify successful receipt.
    # The dispatcher's Celery task will mark the delivery as DELIVERED because of the 200.
    return {"status": "received", "event_id": body_json.get("event_id")}

@router.get("/events", response_model=List[Dict[str, Any]], dependencies=[Depends(require_admin)])
def list_webhook_deliveries(db: Session = Depends(get_db)):
    """Fetch webhook delivery history for the sandbox UI."""
    deliveries = db.query(WebhookDelivery).order_by(WebhookDelivery.created_at.desc()).limit(100).all()
    return [
        {
            "id": d.id,
            "delivery_id": d.delivery_id,
            "event_id": d.event_id,
            "event_type": d.event_type,
            "provider": d.provider,
            "status": d.status,
            "attempt": d.attempt,
            "response_code": d.response_code,
            "latency_ms": d.latency_ms,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "payload": d.payload
        } for d in deliveries
    ]
