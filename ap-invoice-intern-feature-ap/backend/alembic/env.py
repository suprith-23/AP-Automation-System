"""Alembic environment configuration."""
from dotenv import load_dotenv
from pathlib import Path
backend_root = Path(__file__).resolve().parent.parent
load_dotenv(backend_root.parent / ".env.local")
load_dotenv(backend_root.parent / ".env")

import os
import socket
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import sys

sys.path.insert(0, str(backend_root))

from app.core.database import Base
from app.models.invoice import Invoice
from app.models.purchase_order import PurchaseOrder
from app.models.settings import Settings
from app.models.webhook_delivery import WebhookDelivery

target_metadata = Base.metadata

def get_database_url():
    """Use Docker hostname when available, otherwise fall back to localhost."""
    database_url = os.getenv("DATABASE_URL")
    if database_url and "@postgres:5432" in database_url:
        try:
            socket.gethostbyname("postgres")
        except socket.gaierror:
            database_url = database_url.replace("@postgres:5432", "@localhost:5432")
    print("DEBUG MIGRATION DATABASE URL:", database_url)
    return database_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_database_url() or config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_version_num_col_width=128,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    database_url = get_database_url()

    if database_url:
        connectable = engine_from_config(
            {"sqlalchemy.url": database_url},
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
    else:
        connectable = engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

    with connectable.connect() as connection:
        from sqlalchemy import text
        from sqlalchemy import inspect
        from sqlalchemy.types import String
        
        # Check if the table and column exist and if column length is less than 128 before altering
        try:
            inspector = inspect(connection)
            if "alembic_version" in inspector.get_table_names():
                columns = inspector.get_columns("alembic_version")
                for col in columns:
                    if col["name"] == "version_num":
                        col_type = col["type"]
                        if isinstance(col_type, String) and (col_type.length is None or col_type.length < 128):
                            trans = connection.begin()
                            try:
                                connection.execute(text("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(128)"))
                                trans.commit()
                            except Exception:
                                trans.rollback()
                        break
        except Exception:
            # Fallback if inspector fails for any dialect-specific reason
            pass

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_version_num_col_width=128,
        )

        with context.begin_transaction():
            context.run_migrations()
        connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
