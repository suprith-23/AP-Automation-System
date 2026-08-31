"""
API Router for OrgAPIKey CRUD Operations.
Endpoints:
  GET    /api/v1/org-keys          — list all keys in pool
  POST   /api/v1/org-keys          — add new key to pool (Fernet encrypted)
  PUT    /api/v1/org-keys/{id}     — update existing key / priority / status
  DELETE /api/v1/org-keys/{id}     — remove key from pool
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.org_api_key import OrgAPIKey
from app.schemas.org_api_key import (
    OrgAPIKeyCreate,
    OrgAPIKeyUpdate,
    OrgAPIKeyResponse,
)
from app.core.security_key import encrypt_api_key, decrypt_api_key
from app.dependencies import require_admin
from app.ai.providers.pool_manager import KeyPoolCache

router = APIRouter(
    prefix="/org-keys",
    tags=["Org API Key Pool"],
    dependencies=[Depends(require_admin)]
)


def _to_response(row: OrgAPIKey) -> OrgAPIKeyResponse:
    raw_key = decrypt_api_key(row.encrypted_key)
    masked = ("••••" + raw_key[-4:]) if len(raw_key) > 4 else "••••"
    return OrgAPIKeyResponse(
        id=row.id,
        org_id=row.org_id,
        provider_name=row.provider_name,
        key_name=row.key_name,
        masked_key=masked,
        status=row.status,
        priority_order=row.priority_order,
        enabled=row.enabled,
        last_used_at=row.last_used_at,
        last_error=row.last_error,
        cooldown_until=row.cooldown_until
    )


@router.get("", response_model=List[OrgAPIKeyResponse])
def list_keys(db: Session = Depends(get_db)):
    """Return all keys in pool ordered by priority."""
    rows = db.query(OrgAPIKey).order_by(OrgAPIKey.priority_order).all()
    return [_to_response(r) for r in rows]


@router.post("", response_model=OrgAPIKeyResponse, status_code=201)
def add_key(payload: OrgAPIKeyCreate, db: Session = Depends(get_db)):
    """Add a new API key to the hot-swappable pool with Fernet encryption."""
    enc_key = encrypt_api_key(payload.api_key)
    row = OrgAPIKey(
        org_id=payload.org_id,
        provider_name=payload.provider_name.lower(),
        key_name=payload.key_name,
        encrypted_key=enc_key,
        priority_order=payload.priority_order,
        enabled=payload.enabled,
        status="active"
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    KeyPoolCache.get_keys(force_refresh=True)
    return _to_response(row)


@router.put("/{key_id}", response_model=OrgAPIKeyResponse)
def update_key(key_id: int, payload: OrgAPIKeyUpdate, db: Session = Depends(get_db)):
    """Update existing key entry in pool."""
    row = db.query(OrgAPIKey).filter(OrgAPIKey.id == key_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Key entry not found")

    if payload.key_name is not None:
        row.key_name = payload.key_name
    if payload.api_key is not None and payload.api_key.strip():
        row.encrypted_key = encrypt_api_key(payload.api_key)
        row.status = "active"  # Reset status when updated
    if payload.priority_order is not None:
        row.priority_order = payload.priority_order
    if payload.enabled is not None:
        row.enabled = payload.enabled
    if payload.status is not None:
        row.status = payload.status

    db.commit()
    db.refresh(row)
    KeyPoolCache.get_keys(force_refresh=True)
    return _to_response(row)


@router.delete("/{key_id}", status_code=204)
def delete_key(key_id: int, db: Session = Depends(get_db)):
    """Remove key entry from pool."""
    row = db.query(OrgAPIKey).filter(OrgAPIKey.id == key_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Key entry not found")
    db.delete(row)
    db.commit()
    KeyPoolCache.get_keys(force_refresh=True)


@router.post("/{key_id}/test")
async def test_key(key_id: int, db: Session = Depends(get_db)):
    """Test connection for a specific key by executing a lightweight call_api prompt."""
    import time
    import httpx
    from app.ai.providers.universal_provider import UniversalProvider, ProviderConfig

    row = db.query(OrgAPIKey).filter(OrgAPIKey.id == key_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Key entry not found")

    raw_key = decrypt_api_key(row.encrypted_key)
    if not raw_key:
        return {"status": "fail", "latency_ms": 0, "error": "Decryption failed or key is empty"}

    provider_url_map = {
        "groq": ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "openai"),
        "gemini": ("https://generativelanguage.googleapis.com/v1beta/models", "gemini-2.5-flash", "gemini"),
        "nvidia": ("https://integrate.api.nvidia.com/v1", "deepseek-ai/deepseek-v3", "openai"),
        "hf": ("https://router.huggingface.co/v1", "meta-llama/Llama-3.3-70B-Instruct", "openai"),
        "colab": ("http://localhost:8000", "qwen", "colab"),  # fallback values or whatever is in db
    }

    pname = row.provider_name.lower()
    url, model, fmt = provider_url_map.get(pname, ("https://api.openai.com/v1", "gpt-4o-mini", "openai"))

    cfg = ProviderConfig(
        name=pname.capitalize(),
        api_url=url,
        api_key=raw_key,
        model=model,
        response_format=fmt,
    )
    provider = UniversalProvider(cfg)

    # Use a minimal test prompt to keep token/compute usage extremely light
    test_prompt = "Say hello in one word."

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            # call_api expects client, prompt, and optional key overrides.
            await provider.call_api(client, test_prompt, api_key=raw_key)
        latency = int((time.time() - start_time) * 1000)
        return {"status": "success", "latency_ms": latency}
    except Exception as e:
        latency = int((time.time() - start_time) * 1000)
        err_msg = str(e)
        # Update key status dynamically based on error details if needed
        # e.g., if invalid credentials (401), set status='expired', if 429 set rate_limited
        return {"status": "fail", "latency_ms": latency, "error": err_msg}

