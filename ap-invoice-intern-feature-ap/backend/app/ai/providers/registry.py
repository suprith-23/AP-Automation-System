"""
AI Provider Registry
=====================
Builds the ordered list of providers to try for every extraction call.

Sources (merged, deduped, sorted by priority):
  1. Rows in the `ai_provider_configs` DB table  (added via admin UI or API)
  2. Legacy environment variables                 (backward compat — seeded into
     DB on first startup if no DB rows exist yet)

The caller receives a list of (UniversalProvider, api_key) tuples.
It tries them in order, silently moving to the next on any failure.
No provider name is ever exposed to the caller.

To add a new provider:
  Option A — Frontend:  Admin → Settings → AI Providers → Add Provider
  Option B — .env:      Set e.g. MYCO_API_KEY + MYCO_API_URL + MYCO_MODEL,
             then call POST /api/ai-providers/seed to pick them up.
  No code change required in either case.
"""
import os
import logging
from typing import List, Tuple, Optional

from app.ai.providers.universal_provider import UniversalProvider, ProviderConfig
from app.ai.providers.base_provider import BaseAIProvider

logger = logging.getLogger("ai.registry")

# ---------------------------------------------------------------------------
# ENV-based defaults  (used as seed when DB is empty, and as permanent
# fallback when DB is unavailable)
# ---------------------------------------------------------------------------
_ENV_DEFAULTS = [
    # (env_key_for_api_key, api_url_env_or_literal, model_env_or_literal, response_format, default_priority)
    (
        "GROQ_API_KEY",
        ("GROQ_API_URL",    "https://api.groq.com/openai/v1"),
        ("GROQ_MODEL",      "llama-3.3-70b-versatile"),
        "openai", 10,
    ),
    (
        "GEMINI_API_KEY",
        ("GEMINI_API_URL",  "https://generativelanguage.googleapis.com/v1beta/models"),
        ("GEMINI_MODEL",    "gemini-2.5-flash"),
        "gemini", 20,
    ),
    (
        "NVIDIA_API_KEY",
        ("NVIDIA_API_URL",  "https://integrate.api.nvidia.com/v1"),
        ("NVIDIA_MODEL",    "deepseek-ai/deepseek-v3"),
        "openai", 30,
    ),
    (
        "HF_API_KEY",
        ("HF_API_URL",      "https://router.huggingface.co/v1"),
        ("HF_MODEL",        "meta-llama/Llama-3.3-70B-Instruct"),
        "openai", 40,
    ),
    (
        "REMOTE_COLAB_URL",  # key IS the URL for colab
        ("REMOTE_COLAB_URL", ""),
        ("",                 ""),
        "colab", 100,        # optional/manual-only fallback
    ),
]


def _get_clean_env_key(key_env: str) -> str:
    """Helper to retrieve an env key, prioritizing HF_TOKEN for Hugging Face, and filtering placeholder strings."""
    if key_env == "HF_API_KEY":
        hf_token = os.getenv("HF_TOKEN", "").strip()
        if hf_token and not hf_token.lower().startswith("your_"):
            return hf_token
        hf_key = os.getenv("HF_API_KEY", "").strip()
        if hf_key and not hf_key.lower().startswith("your_"):
            return hf_key
        return ""
    
    val = os.getenv(key_env, "").strip()
    if val and not val.lower().startswith("your_"):
        return val
    return ""


def _providers_from_env() -> List[Tuple[UniversalProvider, str]]:
    """Build provider list purely from environment variables (fallback)."""
    result = []
    for entry in _ENV_DEFAULTS:
        key_env, (url_env, url_default), (model_env, model_default), fmt, prio = entry

        api_key = _get_clean_env_key(key_env)
        if not api_key:
            continue

        api_url = os.getenv(url_env, url_default).strip() if url_env else url_default
        model   = os.getenv(model_env, model_default).strip() if model_env else model_default

        # For colab the env var IS the URL, api_key is redundant
        if fmt == "colab":
            api_url = api_key
            api_key = ""

        cfg = ProviderConfig(
            name=key_env.replace("_API_KEY", "").replace("_URL", "").title(),
            api_url=api_url,
            api_key=api_key,
            model=model,
            response_format=fmt,
        )
        result.append((prio, UniversalProvider(cfg), cfg.api_key))

    provider_order_env = os.getenv("LLM_PROVIDER_ORDER")
    if provider_order_env:
        order_list = [name.strip().lower() for name in provider_order_env.split(",") if name.strip()]
        def get_sort_key(item):
            prio, provider, api_key = item
            name = provider.config.name.lower()
            for idx, order_name in enumerate(order_list):
                if order_name in name:
                    return idx
            return len(order_list) + prio
        result.sort(key=get_sort_key)
    else:
        result.sort(key=lambda x: x[0])
    return [(p, k) for _, p, k in result]


def _providers_from_db(preferred_model: Optional[str] = None) -> List[Tuple[UniversalProvider, str]]:
    """
    Load all enabled providers from the DB, sorted by priority.
    If preferred_model matches a provider name/model hint, bump that provider to front.
    """
    try:
        from app.core.database import SessionLocal
        from app.models.ai_provider_config import AIProviderConfig

        db = SessionLocal()
        try:
            rows = (
                db.query(AIProviderConfig)
                .filter(AIProviderConfig.enabled == True)
                .order_by(AIProviderConfig.priority)
                .all()
            )
        finally:
            db.close()

        if not rows:
            return []

        providers = []
        preferred_hit = None
        hint = (preferred_model or "").lower()

        for row in rows:
            cfg = ProviderConfig(
                name=row.name,
                api_url=row.api_url,
                api_key=row.api_key or "",
                model=row.model or "",
                response_format=row.response_format or "openai",
            )
            provider = UniversalProvider(cfg)
            entry = (provider, cfg.api_key)

            # Check if this row matches the admin's preferred model
            if hint and (hint in row.name.lower() or hint in (row.model or "").lower()):
                preferred_hit = entry
            else:
                providers.append(entry)

        # Preferred provider goes first
        if preferred_hit:
            providers.insert(0, preferred_hit)

        return providers

    except Exception as e:
        logger.warning(f"Could not load AI providers from DB: {e}")
        return []


def build_provider_order(
    ai_model_setting: Optional[str] = None,
) -> List[Tuple[BaseAIProvider, str]]:
    """
    Returns the ordered list of (provider, api_key) to try.

    1. Try DB rows first (admin-managed, highest flexibility).
    2. Fall back to env vars if DB is empty or unreachable.
    """
    from app.ai.providers.pool_manager import get_active_pool_providers
    pool_providers = get_active_pool_providers()
    if pool_providers:
        return pool_providers

    db_providers = _providers_from_db(ai_model_setting)
    if db_providers:
        provider_order_env = os.getenv("LLM_PROVIDER_ORDER")
        if provider_order_env:
            order_list = [name.strip().lower() for name in provider_order_env.split(",") if name.strip()]
            def get_sort_key(item):
                provider, api_key = item
                name = provider.config.name.lower()
                for idx, order_name in enumerate(order_list):
                    if order_name in name:
                        return idx
                return len(order_list)
            db_providers.sort(key=get_sort_key)
        return db_providers

    # DB empty or unreachable — use env vars
    return _providers_from_env()


# ---------------------------------------------------------------------------
# Seed DB from env vars on first startup (if table is empty)
# ---------------------------------------------------------------------------
def seed_db_from_env() -> None:
    """
    Called once at startup. Populates the ai_provider_configs table from env vars,
    and synchronizes updated keys or configurations from local env files.
    """
    try:
        from app.core.database import SessionLocal
        from app.models.ai_provider_config import AIProviderConfig

        db = SessionLocal()
        try:
            existing_rows = db.query(AIProviderConfig).all()

            for entry in _ENV_DEFAULTS:
                key_env, (url_env, url_default), (model_env, model_default), fmt, prio = entry
                api_key = _get_clean_env_key(key_env)
                if not api_key:
                    continue

                api_url = os.getenv(url_env, url_default).strip() if url_env else url_default
                model   = os.getenv(model_env, model_default).strip() if model_env else model_default

                if fmt == "colab":
                    api_url = api_key
                    api_key = ""

                # Look for matching provider by response_format or name
                existing_row = None
                for row in existing_rows:
                    if fmt == "gemini" and row.response_format == "gemini":
                        existing_row = row
                    elif fmt == "colab" and row.response_format == "colab":
                        existing_row = row
                    elif fmt == "openai" and row.response_format == "openai":
                        name_hint = key_env.replace("_API_KEY", "").replace("_URL", "").title()
                        if name_hint.lower() in row.name.lower():
                            existing_row = row

                if existing_row:
                    is_dummy = (
                        not existing_row.api_key or 
                        existing_row.api_key.lower().startswith("your_") or 
                        existing_row.api_key == "hf_" + "VTJQThHBNmQkxTdWOfZrHoatwTYJxjESmF"
                    )
                    # Update the existing row if it is a placeholder or if key has changed
                    if is_dummy or (api_key and existing_row.api_key != api_key):
                        existing_row.api_key = api_key
                        if api_url:
                            existing_row.api_url = api_url
                        if model:
                            existing_row.model = model
                        db.add(existing_row)
                        logger.info(f"[AI Registry] Updated and synchronized {existing_row.name} configuration in DB.")
                else:
                    # Create new config entry
                    row = AIProviderConfig(
                        name=key_env.replace("_API_KEY", "").replace("_URL", "").title(),
                        api_url=api_url,
                        api_key=api_key,
                        model=model,
                        response_format=fmt,
                        priority=prio,
                        enabled=True,
                    )
                    db.add(row)
                    logger.info(f"[AI Registry] Seeded and added provider {row.name} to DB.")

            # Also synchronize the org_api_keys table from env vars
            from app.models.org_api_key import OrgAPIKey
            from app.core.security_key import encrypt_api_key, decrypt_api_key

            existing_org_keys = db.query(OrgAPIKey).all()
            for entry in _ENV_DEFAULTS:
                key_env, (url_env, url_default), (model_env, model_default), fmt, prio = entry
                api_key = _get_clean_env_key(key_env)
                if not api_key:
                    continue

                if fmt == "colab":
                    continue

                provider_name = fmt
                key_name = f"System Default {key_env.replace('_API_KEY', '').title()}"

                existing_key = None
                for r in existing_org_keys:
                    if r.provider_name == provider_name and r.key_name == key_name:
                        existing_key = r
                        break

                enc_val = encrypt_api_key(api_key)

                if existing_key:
                    try:
                        decrypted = decrypt_api_key(existing_key.encrypted_key)
                    except Exception:
                        decrypted = ""
                    if decrypted != api_key:
                        existing_key.encrypted_key = enc_val
                        existing_key.status = "active"
                        db.add(existing_key)
                        logger.info(f"[Key Pool] Updated System Default {provider_name} key in pool.")
                else:
                    new_key = OrgAPIKey(
                        provider_name=provider_name,
                        key_name=key_name,
                        encrypted_key=enc_val,
                        priority_order=prio,
                        enabled=True,
                        status="active"
                    )
                    db.add(new_key)
                    logger.info(f"[Key Pool] Seeded System Default {provider_name} key in pool.")

            db.commit()
            
            # Seed TDS sections and rules
            try:
                from app.models.tds import TDSSection, TDSRule
                import json as _json
                
                # Resolve config path
                current_dir = os.path.dirname(os.path.abspath(__file__))
                config_path = os.path.abspath(os.path.join(current_dir, "..", "..", "core", "config", "tds_rules.json"))
                
                if os.path.exists(config_path):
                    with open(config_path, "r") as f:
                        data = _json.load(f)
                        rules = data.get("rules", [])
                        
                    for r in rules:
                        sec_code = r.get("section_code")
                        desc = r.get("description")
                        rate_p = r.get("rate_with_pan", 1.0)
                        rate_w_p = r.get("rate_without_pan", 20.0)
                        single_limit = r.get("single_threshold", 30000.0)
                        agg_limit = r.get("aggregate_threshold", 100000.0)
                        
                        # 1. Seed TDSSection (fractional rates)
                        existing_sec = db.query(TDSSection).filter(TDSSection.section_code == sec_code).first()
                        frac_p = rate_p / 100.0 if rate_p >= 0.5 else rate_p
                        frac_w_p = rate_w_p / 100.0 if rate_w_p >= 0.5 else rate_w_p
                        
                        if not existing_sec:
                            sec = TDSSection(
                                section_code=sec_code,
                                description=desc,
                                rate_with_pan=frac_p,
                                rate_without_pan=frac_w_p,
                                single_threshold=single_limit,
                                aggregate_threshold=agg_limit
                            )
                            db.add(sec)
                        else:
                            # Keep in sync
                            existing_sec.description = desc
                            existing_sec.rate_with_pan = frac_p
                            existing_sec.rate_without_pan = frac_w_p
                            existing_sec.single_threshold = single_limit
                            existing_sec.aggregate_threshold = agg_limit
                            db.add(existing_sec)
                        
                        # 2. Seed TDSRule (percentage rates)
                        existing_rule = db.query(TDSRule).filter(TDSRule.section_code == sec_code).first()
                        pct_p = rate_p if rate_p >= 0.5 else rate_p * 100.0
                        pct_w_p = rate_w_p if rate_w_p >= 0.5 else rate_w_p * 100.0
                        if not existing_rule:
                            rule = TDSRule(
                                section_code=sec_code,
                                description=desc,
                                rate_with_pan=pct_p,
                                rate_without_pan=pct_w_p,
                                single_threshold=single_limit,
                                aggregate_threshold=agg_limit,
                                vendor_categories=_json.dumps(r.get("vendor_categories", [])),
                                expense_categories=_json.dumps(r.get("expense_categories", []))
                            )
                            db.add(rule)
                        else:
                            # Keep in sync
                            existing_rule.description = desc
                            existing_rule.rate_with_pan = pct_p
                            existing_rule.rate_without_pan = pct_w_p
                            existing_rule.single_threshold = single_limit
                            existing_rule.aggregate_threshold = agg_limit
                            db.add(existing_rule)
                    db.commit()
                    logger.info("[TDS Seeding] Successfully seeded TDS sections and rules into database.")
            except Exception as tds_err:
                logger.exception(f"[TDS Seeding] Failed to seed TDS configs: {tds_err}")

        finally:
            db.close()
    except Exception as e:
        logger.exception(f"[AI Registry] CRITICAL: Could not seed/sync DB from env vars: {e}")
        import sys
        print(f"WARNING: [AI Registry] Failed to seed/sync database config from env: {e}", file=sys.stderr)
