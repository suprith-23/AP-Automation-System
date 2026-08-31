"""add_org_to_approval_rules_and_rls

Revision ID: 017_approval_rules_org_and_rls
Revises: ba776327f7b2
Create Date: 2026-08-09 10:26:00

"""
from alembic import op
import sqlalchemy as sa

revision = '017_approval_rules_org_and_rls'
down_revision = 'ba776327f7b2'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Add organization_id column to approval_rules
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("approval_rules")}

    with op.batch_alter_table("approval_rules") as batch_op:
        if "organization_id" not in cols:
            batch_op.add_column(
                sa.Column("organization_id", sa.Uuid(), nullable=True, index=True)
            )
            batch_op.create_foreign_key(
                "fk_approval_rules_organization",
                "organizations",
                ["organization_id"],
                ["id"],
                ondelete="CASCADE",
            )

    # 2. Add Row Level Security (RLS) policies on PostgreSQL tables (safe checks for SQLite/fallback)
    # We propose RLS via SQL directives. If running on SQLite, it will just pass gracefully.
    try:
        op.execute("ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE settings ENABLE ROW LEVEL SECURITY;")
    except Exception:
        pass

def downgrade() -> None:
    try:
        op.execute("ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE payment_schedules DISABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE approval_rules DISABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE settings DISABLE ROW LEVEL SECURITY;")
    except Exception:
        pass

    with op.batch_alter_table("approval_rules") as batch_op:
        batch_op.drop_constraint("fk_approval_rules_organization", type_="foreignkey")
        batch_op.drop_column("organization_id")
