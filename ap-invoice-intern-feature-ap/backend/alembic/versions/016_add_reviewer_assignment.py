"""add_reviewer_assignment

Revision ID: 016_add_reviewer_assignment
Revises: 015_add_org_to_settings
Create Date: 2026-07-31

Adds:
  - invoices.assigned_reviewer_id  (UUID FK → users.id, nullable, SET NULL on delete)
  - invoices.assigned_at           (DateTime, nullable)

These columns power the My Queue feature — the Reviewer sees only invoices
explicitly assigned to them rather than the full org queue.
"""
from alembic import op
import sqlalchemy as sa

revision = '016_add_reviewer_assignment'
down_revision = '015_add_org_to_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("invoices")}

    with op.batch_alter_table("invoices") as batch_op:
        if "assigned_reviewer_id" not in cols:
            batch_op.add_column(
                sa.Column("assigned_reviewer_id", sa.Uuid(), nullable=True)
            )
            batch_op.create_foreign_key(
                "fk_invoices_assigned_reviewer",
                "users",
                ["assigned_reviewer_id"],
                ["id"],
                ondelete="SET NULL",
            )
        if "assigned_at" not in cols:
            batch_op.add_column(
                sa.Column("assigned_at", sa.DateTime(), nullable=True)
            )


def downgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.drop_constraint("fk_invoices_assigned_reviewer", type_="foreignkey")
        batch_op.drop_column("assigned_reviewer_id")
        batch_op.drop_column("assigned_at")
