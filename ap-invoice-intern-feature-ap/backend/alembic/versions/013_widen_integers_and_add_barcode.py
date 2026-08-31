"""widen_integers_and_add_barcode

Revision ID: 013_widen_integers_and_add_barcode
Revises: 97377f56bfd1
Create Date: 2026-07-28 18:16:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '013_widen_integers_and_add_barcode'
down_revision = '97377f56bfd1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Alter invoice_items table
    with op.batch_alter_table('invoice_items') as batch_op:
        batch_op.alter_column('item_number',
               existing_type=sa.Integer(),
               type_=sa.BigInteger(),
               existing_nullable=True)
        
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        cols = {c["name"] for c in inspector.get_columns("invoice_items")}
        if "item_barcode" not in cols:
            batch_op.add_column(sa.Column('item_barcode', sa.String(length=100), nullable=True))

    # 2. Alter invoices table pincodes
    with op.batch_alter_table('invoices') as batch_op:
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        cols = {c["name"] for c in inspector.get_columns("invoices")}
        if "seller_gstin_pincode" in cols:
            batch_op.alter_column('seller_gstin_pincode',
                   existing_type=sa.Integer(),
                   type_=sa.BigInteger(),
                   existing_nullable=False)
        if "buyer_gstin_pincode" in cols:
            batch_op.alter_column('buyer_gstin_pincode',
                   existing_type=sa.Integer(),
                   type_=sa.BigInteger(),
                   existing_nullable=False)
        if "shipping_gstin_pincode" in cols:
            batch_op.alter_column('shipping_gstin_pincode',
                   existing_type=sa.Integer(),
                   type_=sa.BigInteger(),
                   existing_nullable=False)


def downgrade() -> None:
    # 1. Revert invoices table pincodes
    with op.batch_alter_table('invoices') as batch_op:
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        cols = {c["name"] for c in inspector.get_columns("invoices")}
        if "seller_gstin_pincode" in cols:
            batch_op.alter_column('seller_gstin_pincode',
                   existing_type=sa.BigInteger(),
                   type_=sa.Integer(),
                   existing_nullable=False)
        if "buyer_gstin_pincode" in cols:
            batch_op.alter_column('buyer_gstin_pincode',
                   existing_type=sa.BigInteger(),
                   type_=sa.Integer(),
                   existing_nullable=False)
        if "shipping_gstin_pincode" in cols:
            batch_op.alter_column('shipping_gstin_pincode',
                   existing_type=sa.BigInteger(),
                   type_=sa.Integer(),
                   existing_nullable=False)

    # 2. Revert invoice_items table
    with op.batch_alter_table('invoice_items') as batch_op:
        batch_op.drop_column('item_barcode')
        batch_op.alter_column('item_number',
               existing_type=sa.BigInteger(),
               type_=sa.Integer(),
               existing_nullable=True)
