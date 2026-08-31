"""
Universal Key Pool Manager with 30s in-memory TTL cache, hot-swappable key rotation, 
cooldown tracking on 429 rate limits, and status updating on 401 invalid keys.
"""

import time
import logging
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
import httpx

from app.core.database import SessionLocal
from app.models.org_api_key import OrgAPIKey
from app.core.security_key import decrypt_api_key
from app.ai.providers.universal_provider import UniversalProvider, ProviderConfig

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 30.0


class KeyPoolCache:
    _instance: Optional["KeyPoolCache"] = None
    _cached_keys: List[dict] = []
    _last_fetched: float = 0.0

    @classmethod
    def get_keys(cls, force_refresh: bool = False) -> List[dict]:
        now = time.time()
        if force_refresh or (now - cls._last_fetched) > CACHE_TTL_SECONDS:
            cls._refresh_cache()
        return cls._cached_keys

    @classmethod
    def _refresh_cache(cls):
        db: Session = SessionLocal()
        try:
            now_utc = datetime.utcnow()
            # Clear rate_limited status if cooldown_until has passed
            db.query(OrgAPIKey).filter(
                OrgAPIKey.status == "rate_limited",
                OrgAPIKey.cooldown_until <= now_utc
            ).update({"status": "active", "cooldown_until": None})
            db.commit()

            rows = db.query(OrgAPIKey).filter(
                OrgAPIKey.enabled == True,
                OrgAPIKey.status == "active"
            ).order_by(OrgAPIKey.priority_order).all()

            cls._cached_keys = [
                {
                    "id": row.id,
                    "org_id": row.org_id,
                    "provider_name": row.provider_name.lower(),
                    "key_name": row.key_name,
                    "api_key": decrypt_api_key(row.encrypted_key),
                    "priority_order": row.priority_order
                }
                for row in rows
            ]
            cls._last_fetched = time.time()
        except Exception as e:
            logger.error(f"Failed to refresh UniversalKeyPoolCache from DB: {e}")
        finally:
            db.close()

    @classmethod
    def mark_key_status(cls, key_id: int, status: str, error_msg: str = "", cooldown_seconds: float = 0.0):
        db: Session = SessionLocal()
        try:
            row = db.query(OrgAPIKey).filter(OrgAPIKey.id == key_id).first()
            if row:
                old_status = row.status
                row.status = status
                row.last_error = error_msg[:500] if error_msg else None
                if status == "rate_limited" and cooldown_seconds > 0:
                    row.cooldown_until = datetime.utcnow() + timedelta(seconds=cooldown_seconds)
                db.commit()
                
                logger.warning(
                    f"API Key Hot-Swap/Rotation Triggered: Key '{row.key_name}' (ID: {key_id}, Provider: {row.provider_name}) "
                    f"rotated from '{old_status}' to '{status}'. Reason: {error_msg}"
                )
                
                # Increment metrics
                from app.core.metrics import LLM_API_KEY_POOL_EXHAUSTION
                LLM_API_KEY_POOL_EXHAUSTION.inc()
                
            cls._refresh_cache()
        except Exception as e:
            logger.error(f"Failed to mark key status for ID {key_id}: {e}")
        finally:
            db.close()



def get_active_pool_providers() -> List[Tuple[UniversalProvider, str, int]]:
    """
    Returns an ordered list of (UniversalProvider, raw_api_key, key_id)
    available in the current active pool.
    """
    keys = KeyPoolCache.get_keys()
    providers: List[Tuple[UniversalProvider, str, int]] = []

    # Map provider name to default configs if available
    provider_url_map = {
        "groq": ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", "openai"),
        "gemini": ("https://generativelanguage.googleapis.com/v1beta/models", "gemini-2.5-flash", "gemini"),
        "nvidia": ("https://integrate.api.nvidia.com/v1", "deepseek-ai/deepseek-v3", "openai"),
        "hf": ("https://router.huggingface.co/v1", "meta-llama/Llama-3.3-70B-Instruct", "openai"),
    }

    for item in keys:
        pname = item["provider_name"]
        if pname in provider_url_map:
            url, model, fmt = provider_url_map[pname]
            cfg = ProviderConfig(
                name=pname.capitalize(),
                api_url=url,
                api_key=item["api_key"],
                model=model,
                response_format=fmt,
            )
            providers.append((UniversalProvider(cfg), item["api_key"], item["id"]))

    return providers
