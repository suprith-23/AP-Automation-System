"""Alembic migration 011 — add workflow escalation and SLA grace period columns.

Revision ID: 011_add_workflow_sla_settings
Revises: 010_add_gst_settings
Create Date: 2026-07-26
"""
from alembic import op
import sqlalchemy as sa

revision = "011_add_workflow_sla_settings"
down_revision = "010_add_gst_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_cols = {c["name"] for c in inspector.get_columns("settings")}

    new_cols = [
        ("escalation_role", sa.String(), "Admin"),
        ("sla_grace_period_hours", sa.Integer(), 2),
    ]
    for col_name, col_type, default in new_cols:
        if col_name not in existing_cols:
            if isinstance(default, str):
                server_default_val = f"'{default}'"
            else:
                server_default_val = str(default)
            op.add_column(
                "settings",
                sa.Column(col_name, col_type, nullable=False, server_default=sa.text(server_default_val)),
            )


def downgrade() -> None:
    op.drop_column("settings", "sla_grace_period_hours")
    op.drop_column("settings", "escalation_role")
