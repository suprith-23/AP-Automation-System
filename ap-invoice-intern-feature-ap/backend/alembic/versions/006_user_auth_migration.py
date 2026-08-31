"""add user auth columns and convert ID to UUID

Revision ID: 006_user_auth_migration
Revises: 005_add_hsn_rate_breakdown
Create Date: 2026-07-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "006_user_auth_migration"
down_revision = "b22593e9c820"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Drop existing table to cleanly transition to UUID primary keys and hashing fields
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), unique=True, index=True, nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("designation", sa.String(), nullable=False, server_default="Staff"),
        sa.Column("status", sa.String(), nullable=False, server_default="Active"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_login", sa.DateTime(), nullable=True),
    )

def downgrade() -> None:
    op.drop_table("users")
    # Restore the original integer-based users table structure
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), unique=True, index=True, nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("designation", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="Active"),
    )
