"""
conftest.py — shared fixtures for AP-Automation backend tests.

Sets DATABASE_URL and stubs unavailable third-party modules (celery, redis)
BEFORE any app.* import so that module-level create_engine() and Celery()
calls do not fail in the test environment.
"""
import sys
import os
from unittest.mock import MagicMock

# ── 1. Set DATABASE_URL so app.core.database imports cleanly ──────────────────
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ALGORITHM", "HS256")

# ── 2. Stub heavy / unavailable third-party packages ─────────────────────────

def _stub_module(name: str, **attrs):
    """Register a MagicMock as a sys.modules entry so imports don't fail."""
    if name not in sys.modules:
        mod = MagicMock()
        for k, v in attrs.items():
            setattr(mod, k, v)
        sys.modules[name] = mod
    return sys.modules[name]


# Celery
_celery_mod = _stub_module("celery")
_celery_app_mock = MagicMock()
_celery_app_mock.task = lambda *a, **kw: (lambda f: f)   # passthrough decorator
_celery_mod.Celery = MagicMock(return_value=_celery_app_mock)
_stub_module("celery.signals")
_stub_module("celery.signals.task_prerun")

# Redis (used by tasks.py queue-depth helper)
_stub_module("redis")

# billiard / kombu (celery internals that may be imported transitively)
_stub_module("billiard")
_stub_module("kombu")

# prometheus_client
_prom = _stub_module("prometheus_client")
_prom.Counter = MagicMock()
_prom.Histogram = MagicMock()
_prom.Gauge = MagicMock()
_prom.REGISTRY = MagicMock()
