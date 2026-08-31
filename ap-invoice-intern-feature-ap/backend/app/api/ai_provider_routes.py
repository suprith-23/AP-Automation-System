"""CRUD API for AI provider configurations.

Endpoints:
  GET    /api/ai-providers          — list all
  POST   /api/ai-providers          — add new provider
  PUT    /api/ai-providers/{id}     — update existing
  DELETE /api/ai-providers/{id}     — remove
  POST   /api/ai-providers/seed     — re-seed from current env vars
  POST   /api/ai-providers/{id}/test — test a provider with a sample prompt
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.ai_provider_config import AIProviderConfig
from app.schemas.ai_provider_config import (
    AIProviderConfigCreate,
    AIProviderConfigUpdate,
    AIProviderConfigResponse,
)

from app.dependencies import require_admin

router = APIRouter(
    prefix="/ai-providers",
    tags=["AI Providers"],
    dependencies=[Depends(require_admin)]
)


@router.get("", response_model=List[AIProviderConfigResponse])
def list_providers(db: Session = Depends(get_db)):
    """Return all configured AI providers (API keys are masked)."""
    return db.query(AIProviderConfig).order_by(AIProviderConfig.priority).all()


@router.post("", response_model=AIProviderConfigResponse, status_code=201)
def add_provider(payload: AIProviderConfigCreate, db: Session = Depends(get_db)):
    """Add a new AI provider."""
    row = AIProviderConfig(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{provider_id}", response_model=AIProviderConfigResponse)
def update_provider(provider_id: int, payload: AIProviderConfigUpdate, db: Session = Depends(get_db)):
    """Update an existing AI provider. Only supplied fields are changed."""
    row = db.query(AIProviderConfig).filter(AIProviderConfig.id == provider_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "api_key" and isinstance(value, str) and (value.startswith("••••") or not value.strip()):
            continue
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{provider_id}", status_code=204)
def delete_provider(provider_id: int, db: Session = Depends(get_db)):
    """Remove an AI provider."""
    row = db.query(AIProviderConfig).filter(AIProviderConfig.id == provider_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(row)
    db.commit()


@router.post("/seed", status_code=200)
def seed_providers(db: Session = Depends(get_db)):
    """Re-read env vars and insert any providers that are not yet in the DB."""
    from app.ai.providers.registry import seed_db_from_env
    seed_db_from_env()
    count = db.query(AIProviderConfig).count()
    return {"message": f"Seed complete. {count} provider(s) in table."}


@router.post("/{provider_id}/test")
async def test_provider(provider_id: int, db: Session = Depends(get_db)):
    """Run a quick test extraction against a single provider."""
    row = db.query(AIProviderConfig).filter(AIProviderConfig.id == provider_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")

    from app.ai.providers.universal_provider import UniversalProvider, ProviderConfig
    import httpx

    cfg = ProviderConfig(
        name=row.name,
        api_url=row.api_url,
        api_key=row.api_key or "",
        model=row.model or "",
        response_format=row.response_format or "openai",
    )
    provider = UniversalProvider(cfg)

    test_prompt = (
        'Return valid JSON only: {"status": "ok", "provider": "' + row.name + '", "echo": "test_passed"}'
    )

    try:
        async with httpx.AsyncClient() as client:
            # Bypass the @retry_async decorator to fail fast and prevent frontend timeouts during testing
            # Use a short timeout of 5 seconds for connection test
            test_timeout = httpx.Timeout(5.0, connect=3.0, read=5.0)
            if hasattr(provider.call_api, "__wrapped__"):
                result = await provider.call_api.__wrapped__(provider, client, test_prompt, cfg.api_key, timeout=test_timeout)
            else:
                result = await provider.call_api(client, test_prompt, cfg.api_key, timeout=test_timeout)
        return {"success": True, "response": result[:300]}
    except Exception as e:
        return {"success": False, "error": str(e)}
