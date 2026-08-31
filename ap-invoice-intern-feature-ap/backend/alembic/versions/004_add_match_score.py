"""add match_score to invoices

Revision ID: 004_add_match_score
Revises: 003_add_ocr_fields
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_add_match_score'
down_revision = '003_add_ocr_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('match_score', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'match_score')
