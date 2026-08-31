"""add_org_to_settings

Revision ID: 015_add_org_to_settings
Revises: 014_retire_finance_manager_role
Create Date: 2026-07-31

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '015_add_org_to_settings'
down_revision = '014_retire_finance_manager_role'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # 1. Add organization_id column to settings table if it doesn't exist
    cols = {c["name"] for c in inspector.get_columns("settings")}
    if "organization_id" not in cols:
        # SQLite batch mode safe foreign key addition
        with op.batch_alter_table("settings") as batch_op:
            batch_op.add_column(sa.Column("organization_id", sa.Uuid(), nullable=True, index=True))
            batch_op.create_foreign_key(
                "fk_settings_organization",
                "organizations",
                ["organization_id"],
                ["id"],
                ondelete="CASCADE"
            )


def downgrade() -> None:
    with op.batch_alter_table("settings") as batch_op:
        batch_op.drop_constraint("fk_settings_organization", type_="foreignkey")
        batch_op.drop_column("organization_id")
