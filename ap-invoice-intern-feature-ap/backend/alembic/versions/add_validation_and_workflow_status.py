"""add_validation_and_workflow_status

Revision ID: add_validation_and_workflow_status
Revises: None
Create Date: 2026-05-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_validation'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add validation workflow columns and relax required invoice fields."""
    op.add_column('invoices', sa.Column('validation_status', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('workflow_status', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('validation_errors', sa.JSON(), nullable=True))

    op.alter_column('invoices', 'invoice_number', existing_type=sa.String(), nullable=True)
    op.alter_column('invoices', 'vendor_name', existing_type=sa.String(), nullable=True)
    op.alter_column('invoices', 'invoice_date', existing_type=sa.Date(), nullable=True)
    op.alter_column('invoices', 'due_date', existing_type=sa.Date(), nullable=True)
    op.alter_column('invoices', 'subtotal', existing_type=sa.Float(), nullable=True)
    op.alter_column('invoices', 'tax_amount', existing_type=sa.Float(), nullable=True)
    op.alter_column('invoices', 'total_amount', existing_type=sa.Float(), nullable=True)
    op.alter_column('invoices', 'currency', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    """Remove validation workflow columns and restore required fields."""
    op.alter_column('invoices', 'currency', existing_type=sa.String(), nullable=False)
    op.alter_column('invoices', 'total_amount', existing_type=sa.Float(), nullable=False)
    op.alter_column('invoices', 'tax_amount', existing_type=sa.Float(), nullable=False)
    op.alter_column('invoices', 'subtotal', existing_type=sa.Float(), nullable=False)
    op.alter_column('invoices', 'due_date', existing_type=sa.Date(), nullable=False)
    op.alter_column('invoices', 'invoice_date', existing_type=sa.Date(), nullable=False)
    op.alter_column('invoices', 'vendor_name', existing_type=sa.String(), nullable=False)
    op.alter_column('invoices', 'invoice_number', existing_type=sa.String(), nullable=False)
    
    op.drop_column('invoices', 'validation_errors')
    op.drop_column('invoices', 'workflow_status')
    op.drop_column('invoices', 'validation_status')
