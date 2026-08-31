"""Alembic migration 012 — add PO match tolerance columns to settings table.

Revision ID: 012_add_po_match_tolerances
Revises: 011_add_workflow_sla_settings
Create Date: 2026-07-26
"""
from alembic import op
import sqlalchemy as sa

revision = "012_add_po_match_tolerances"
down_revision = "011_add_workflow_sla_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_cols = {c["name"] for c in inspector.get_columns("settings")}

    new_cols = [
        ("po_qty_tolerance_pct", sa.Float(), 5.0),
        ("po_price_tolerance_pct", sa.Float(), 2.0),
        ("po_tax_tolerance_pct", sa.Float(), 0.0),
        ("po_freight_tolerance_amount", sa.Float(), 50.0),
        ("po_vendor_name_threshold_pct", sa.Float(), 85.0),
        ("po_min_match_score", sa.Float(), 80.0),
    ]
    for col_name, col_type, default in new_cols:
        if col_name not in existing_cols:
            op.add_column(
                "settings",
                sa.Column(col_name, col_type, nullable=False, server_default=str(default)),
            )


def downgrade() -> None:
    for col_name in [
        "po_qty_tolerance_pct",
        "po_price_tolerance_pct",
        "po_tax_tolerance_pct",
        "po_freight_tolerance_amount",
        "po_vendor_name_threshold_pct",
        "po_min_match_score",
    ]:
        op.drop_column("settings", col_name)
