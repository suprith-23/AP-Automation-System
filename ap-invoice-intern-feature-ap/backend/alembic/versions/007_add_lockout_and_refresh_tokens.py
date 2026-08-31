"""add lockout and refresh tokens

Revision ID: 007_add_lockout_and_refresh_tokens
Revises: 006_user_auth_migration
Create Date: 2026-07-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "007_add_lockout_and_refresh_tokens"
down_revision = "006_user_auth_migration"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add brute-force protection lockout columns to users table
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(), nullable=True))
    
    # Create refresh_tokens table
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column("token", sa.String(), unique=True, index=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false")
    )

def downgrade() -> None:
    # Drop refresh_tokens table
    op.drop_table("refresh_tokens")
    
    # Remove lockout columns from users table
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
