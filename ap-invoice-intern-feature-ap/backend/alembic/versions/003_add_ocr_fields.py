"""add ocr fields

Revision ID: 003_add_ocr_fields
Revises: 002_canonical_invoice
Create Date: 2026-06-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_add_ocr_fields'
down_revision = '002_canonical_invoice'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('raw_ocr_text', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('extracted_json', sa.JSON(), nullable=True))
    op.add_column('invoices', sa.Column('confidence_json', sa.JSON(), nullable=True))
    op.add_column('invoices', sa.Column('extraction_timestamp', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'extraction_timestamp')
    op.drop_column('invoices', 'confidence_json')
    op.drop_column('invoices', 'extracted_json')
    op.drop_column('invoices', 'raw_ocr_text')
