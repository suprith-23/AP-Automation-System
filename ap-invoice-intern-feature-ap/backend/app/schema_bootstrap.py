"""Helpers to reconcile existing database schemas with Alembic revisions."""

import logging
import os
from pathlib import Path
import subprocess

from sqlalchemy import inspect
from sqlalchemy.engine import Engine


logger = logging.getLogger(__name__)

ALEMBIC_HEAD = "020_add_vendor_and_bank_details"

REVISION_001_COLUMNS = {
    "validation_errors",
    "validation_status",
    "workflow_status",
}
REVISION_002_COLUMNS = {
    "confidence_score",
    "match_status",
    "processed_at",
    "seller_gstin",
    "source_type",
    "total_invoice_value",
    "type_of_invoice",
}
REVISION_003_COLUMNS = {
    "confidence_json",
    "extracted_json",
    "extraction_timestamp",
    "raw_ocr_text",
}
HSN_RATE_COLUMNS = {
    "cgst_rate",
    "sgst_rate",
    "igst_rate",
}


def _get_project_root() -> Path:
    """Return the backend project root that contains alembic.ini."""
    return Path(__file__).resolve().parents[1]


def _run_alembic(*args: str) -> None:
    """Run Alembic through its CLI to avoid local package shadowing."""
    project_root = _get_project_root()
    command = [
        "alembic",
        "-c",
        str(project_root / "alembic.ini"),
        *args,
    ]
    subprocess.run(command, check=True, cwd=project_root)


def infer_revision_from_schema(
    table_names: set[str],
    invoice_columns: set[str],
    hsn_columns: set[str] | None = None,
) -> str | None:
    """Infer the closest Alembic revision for an existing invoices schema."""
    hsn_columns = hsn_columns or set()

    if "invoices" not in table_names:
        return ALEMBIC_HEAD if not table_names else None

    if "match_score" in invoice_columns and HSN_RATE_COLUMNS.issubset(hsn_columns):
        return ALEMBIC_HEAD

    if "match_score" in invoice_columns:
        return "004_add_match_score"

    if "invoice_items" in table_names and REVISION_003_COLUMNS.issubset(invoice_columns):
        return "003_add_ocr_fields"

    if "invoice_items" in table_names and REVISION_002_COLUMNS.issubset(invoice_columns):
        return "002_canonical_invoice"

    if REVISION_001_COLUMNS.issubset(invoice_columns):
        return "001_validation"

    return None


def ensure_database_schema_current(engine: Engine) -> None:
    """Stamp unstamped databases and upgrade them to the latest Alembic revision."""
    if os.getenv("TESTING") == "True" or os.getenv("SKIP_DB_BOOTSTRAP", "").lower() in {"1", "true", "yes"}:
        logger.info("Skipping database schema bootstrap.")
        return

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    invoice_columns = (
        {column["name"] for column in inspector.get_columns("invoices")}
        if "invoices" in table_names
        else set()
    )
    hsn_columns = (
        {column["name"] for column in inspector.get_columns("hsn_master")}
        if "hsn_master" in table_names
        else set()
    )

    if "alembic_version" not in table_names:
        # Fresh database: create_all already ran so all tables exist.
        # Just stamp at the current head so Alembic knows where we are.
        if not table_names or "invoices" not in table_names:
            # Truly empty DB — create_all is about to run, nothing to stamp yet.
            logger.info("Fresh empty database detected; skipping Alembic stamp.")
            return

        inferred_revision = infer_revision_from_schema(table_names, invoice_columns, hsn_columns)

        if inferred_revision:
            logger.info("Stamping database at Alembic revision %s", inferred_revision)
            try:
                _run_alembic("stamp", inferred_revision)
            except Exception as exc:
                logger.warning("Alembic stamp failed (%s); stamping directly at head instead.", exc)
                try:
                    _run_alembic("stamp", "head")
                except Exception as exc2:
                    logger.warning("Alembic stamp head also failed (%s); continuing anyway.", exc2)
                    return
        else:
            logger.info("No prior schema detected; stamping directly at head.")
            try:
                _run_alembic("stamp", "head")
            except Exception as exc:
                logger.warning("Alembic stamp head failed (%s); continuing anyway.", exc)
                return

    try:
        _run_alembic("upgrade", "head")
    except Exception as exc:
        logger.warning("Alembic upgrade head failed (%s); schema may already be current.", exc)

