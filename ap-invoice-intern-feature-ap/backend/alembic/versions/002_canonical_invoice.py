"""add canonical invoice fields and items table

Revision ID: 002_canonical_invoice
Revises: 001_validation
Create Date: 2026-06-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_canonical_invoice'
down_revision = '001_validation'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create invoice_items table
    op.create_table(
        'invoice_items',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('invoice_id', sa.Integer(), sa.ForeignKey('invoices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_number', sa.Integer(), nullable=True),
        sa.Column('sl_no', sa.String(), nullable=True),
        sa.Column('is_service', sa.String(), server_default='N', nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('hsn_code', sa.String(), nullable=True),
        sa.Column('quantity', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('unit', sa.String(), nullable=True),
        sa.Column('unit_price', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('total_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('discount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('assessable_value', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('gst_rate', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('igst_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('cgst_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('sgst_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('cess_rate', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('cess_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('cess_non_advalorem_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('state_cess_rate', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('state_cess_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('other_charges', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('total_item_value', sa.Float(), server_default='0.0', nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invoice_items_id'), 'invoice_items', ['id'], unique=False)

    # 2. Add new columns to invoices table
    op.add_column('invoices', sa.Column('type_of_invoice', sa.String(), server_default='TAX_INVOICE', nullable=False))
    op.add_column('invoices', sa.Column('irn', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('seller_gstin', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('seller_gstin_pincode', sa.Integer(), server_default='0', nullable=False))
    op.add_column('invoices', sa.Column('buyer_gstin', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('buyer_gstin_pincode', sa.Integer(), server_default='0', nullable=False))
    op.add_column('invoices', sa.Column('shipping_gstin', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('shipping_gstin_pincode', sa.Integer(), server_default='0', nullable=False))
    op.add_column('invoices', sa.Column('total_taxable_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_gst_rate', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_cgst_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_sgst_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_igst_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_ces_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_st_ces_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_discount_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('round_off_amount', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_accessment_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('total_invoice_value', sa.Float(), server_default='0.0', nullable=False))
    op.add_column('invoices', sa.Column('match_status', sa.String(), server_default='pending', nullable=False))
    op.add_column('invoices', sa.Column('confidence_score', sa.Float(), nullable=True))
    op.add_column('invoices', sa.Column('source_type', sa.String(), server_default='json_api', nullable=False))
    op.add_column('invoices', sa.Column('processed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # 1. Drop new columns from invoices table
    op.drop_column('invoices', 'processed_at')
    op.drop_column('invoices', 'source_type')
    op.drop_column('invoices', 'confidence_score')
    op.drop_column('invoices', 'match_status')
    op.drop_column('invoices', 'total_invoice_value')
    op.drop_column('invoices', 'total_accessment_value')
    op.drop_column('invoices', 'round_off_amount')
    op.drop_column('invoices', 'total_discount_value')
    op.drop_column('invoices', 'total_st_ces_value')
    op.drop_column('invoices', 'total_ces_value')
    op.drop_column('invoices', 'total_igst_value')
    op.drop_column('invoices', 'total_sgst_value')
    op.drop_column('invoices', 'total_cgst_value')
    op.drop_column('invoices', 'total_gst_rate')
    op.drop_column('invoices', 'total_taxable_value')
    op.drop_column('invoices', 'shipping_gstin_pincode')
    op.drop_column('invoices', 'shipping_gstin')
    op.drop_column('invoices', 'buyer_gstin_pincode')
    op.drop_column('invoices', 'buyer_gstin')
    op.drop_column('invoices', 'seller_gstin_pincode')
    op.drop_column('invoices', 'seller_gstin')
    op.drop_column('invoices', 'irn')
    op.drop_column('invoices', 'type_of_invoice')

    # 2. Drop invoice_items table
    op.drop_index(op.f('ix_invoice_items_id'), table_name='invoice_items')
    op.drop_table('invoice_items')
