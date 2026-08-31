"""Alembic migration 010 — add GST settings columns + gst_hsn_rules table.

Revision ID: 010_add_gst_settings
Revises: 009_create_tds_rules_table
Create Date: 2026-07-25
"""
from alembic import op
import sqlalchemy as sa
import json
import os

revision = "010_add_gst_settings"
down_revision = "009_create_tds_rules_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── 1. Add GST scalar columns to existing settings table ──────────────────
    existing_cols = {c["name"] for c in inspector.get_columns("settings")}

    new_cols = [
        ("gst_tolerance_amount",            sa.Float(),   1.0),
        ("gst_reconciliation_threshold_pct", sa.Float(), 98.0),
        ("gst_max_past_days",               sa.Integer(), 30),
        ("gst_prevent_duplicate_irn",       sa.Boolean(), True),
        ("gst_check_date_consistency",      sa.Boolean(), True),
    ]
    for col_name, col_type, default in new_cols:
        if col_name not in existing_cols:
            op.add_column(
                "settings",
                sa.Column(col_name, col_type, nullable=False, server_default=str(default)),
            )

    # ── 2. Create gst_hsn_rules table ─────────────────────────────────────────
    tables = inspector.get_table_names()
    if "gst_hsn_rules" not in tables:
        op.create_table(
            "gst_hsn_rules",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
            sa.Column("organization_id", sa.Uuid(), nullable=True),
            sa.Column("hsn_prefix", sa.String(), nullable=False),
            sa.Column("rule_type", sa.String(), nullable=False),
            sa.ForeignKeyConstraint(
                ["organization_id"], ["organizations.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_gst_hsn_rules_id"), "gst_hsn_rules", ["id"], unique=False)
        op.create_index(
            op.f("ix_gst_hsn_rules_organization_id"),
            "gst_hsn_rules",
            ["organization_id"],
            unique=False,
        )
        op.create_index(
            op.f("ix_gst_hsn_rules_rule_type"),
            "gst_hsn_rules",
            ["rule_type"],
            unique=False,
        )
        op.create_index(
            op.f("ix_gst_hsn_rules_hsn_prefix"),
            "gst_hsn_rules",
            ["hsn_prefix"],
            unique=False,
        )

        # ── 3. Seed from compliance_rules.json ─────────────────────────────────
        try:
            current_dir = os.path.dirname(os.path.realpath(__file__))
            config_path = os.path.abspath(
                os.path.join(
                    current_dir, "..", "..", "app", "core", "config", "compliance_rules.json"
                )
            )
            if os.path.exists(config_path):
                with open(config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                hsn_sac = data.get("hsn_sac", {})
                rcm_codes = hsn_sac.get("rcm_hsn_codes", [])
                blocked_codes = hsn_sac.get("blocked_itc_hsn_codes", [])

                tb = sa.table(
                    "gst_hsn_rules",
                    sa.column("hsn_prefix", sa.String),
                    sa.column("rule_type", sa.String),
                    sa.column("organization_id", sa.Uuid),
                )
                rows = []
                for code in rcm_codes:
                    rows.append(
                        {"hsn_prefix": str(code), "rule_type": "RCM", "organization_id": None}
                    )
                for code in blocked_codes:
                    rows.append(
                        {"hsn_prefix": str(code), "rule_type": "BLOCKED_ITC", "organization_id": None}
                    )
                if rows:
                    op.bulk_insert(tb, rows)
        except Exception as exc:  # noqa: BLE001
            # Seed failure is non-fatal; JSON fallback still active in service layer.
            import logging
            logging.getLogger("alembic").warning("GST HSN seed failed: %s", exc)


def downgrade() -> None:
    # Drop table
    op.drop_index(op.f("ix_gst_hsn_rules_hsn_prefix"), table_name="gst_hsn_rules")
    op.drop_index(op.f("ix_gst_hsn_rules_rule_type"), table_name="gst_hsn_rules")
    op.drop_index(op.f("ix_gst_hsn_rules_organization_id"), table_name="gst_hsn_rules")
    op.drop_index(op.f("ix_gst_hsn_rules_id"), table_name="gst_hsn_rules")
    op.drop_table("gst_hsn_rules")

    # Drop added columns
    for col_name in [
        "gst_check_date_consistency",
        "gst_prevent_duplicate_irn",
        "gst_max_past_days",
        "gst_reconciliation_threshold_pct",
        "gst_tolerance_amount",
    ]:
        op.drop_column("settings", col_name)
