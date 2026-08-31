"""add password reset tokens table

Revision ID: 008_add_password_reset_tokens_table
Revises: a1b2c3d4e5f6
Create Date: 2026-07-22

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "008_add_password_reset_tokens_table"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create password_reset_tokens table if it does not exist
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if "password_reset_tokens" not in tables:
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, index=True),
            sa.Column("token_hash", sa.String(), unique=True, index=True, nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now())
        )


def downgrade() -> None:
    # Drop password_reset_tokens table
    op.drop_table("password_reset_tokens")
