"""add HSN tax rate breakdown columns

Revision ID: 005_add_hsn_rate_breakdown
Revises: 004_add_match_score
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "005_add_hsn_rate_breakdown"
down_revision = "004_add_match_score"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hsn_master", sa.Column("cgst_rate", sa.Float(), nullable=True))
    op.add_column("hsn_master", sa.Column("sgst_rate", sa.Float(), nullable=True))
    op.add_column("hsn_master", sa.Column("igst_rate", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("hsn_master", "igst_rate")
    op.drop_column("hsn_master", "sgst_rate")
    op.drop_column("hsn_master", "cgst_rate")
