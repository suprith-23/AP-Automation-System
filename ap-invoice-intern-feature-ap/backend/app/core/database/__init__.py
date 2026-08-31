"""Database connection and session helpers."""

import logging
import os
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, Session
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("ap_automation.database")


DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and "@postgres" in DATABASE_URL:
    import socket
    try:
        socket.gethostbyname("postgres")
    except socket.gaierror:
        DATABASE_URL = DATABASE_URL.replace("@postgres", "@localhost")



# Create one shared engine for the application.
if DATABASE_URL and DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30}
    )
else:
    engine = create_engine(DATABASE_URL)

import time
from sqlalchemy import event

@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    try:
        from app.core.metrics import DB_CONNECTION_POOL_ACTIVE
        DB_CONNECTION_POOL_ACTIVE.inc()
    except Exception:
        pass

@event.listens_for(engine, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    try:
        from app.core.metrics import DB_CONNECTION_POOL_ACTIVE
        DB_CONNECTION_POOL_ACTIVE.dec()
    except Exception:
        pass

@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, execmany):
    if context:
        context._query_start_time = time.time()

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, execmany):
    if context and hasattr(context, "_query_start_time"):
        total_time = time.time() - context._query_start_time
        try:
            from app.core.metrics import DB_QUERY_DURATION
            DB_QUERY_DURATION.observe(total_time)
        except Exception:
            pass



# Give each request its own database session.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# Base class for all SQLAlchemy models.
Base = declarative_base()

# Models will be imported at application startup in main.py to register metadata.


def set_tenant_context(db: Session, organization_id: Optional[str]) -> None:
    """
    Set the PostgreSQL session-local variable 'app.current_org_id' so that
    row-level security policies can enforce per-tenant data isolation.

    For Super Admin users, pass the sentinel 'BYPASS_RLS_SUPERADMIN' to allow
    cross-tenant access.  For all other users, pass the UUID string of the
    user's organization_id.

    This is a no-op on SQLite (development/test without PostgreSQL).
    """
    if db.bind and db.bind.dialect.name != "postgresql":
        return
    try:
        value = organization_id or ""
        db.execute(text("SELECT set_config('app.current_org_id', :v, TRUE)"), {"v": value})
    except Exception as exc:
        logger.warning(f"Failed to set tenant RLS context: {exc}")


def get_db():
    """
    Purpose:
        Yield a database session for the current request.
    Inputs:
        None.
    Outputs:
        - Session: SQLAlchemy session instance yielded for request duration.
    """
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()
