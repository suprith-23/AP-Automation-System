"""fix_invoice_number_unique_constraint

Revision ID: a1b2c3d4e5f6
Revises: 5f99dcf33b66
Create Date: 2026-07-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '5f99dcf33b66'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Drop old unique constraint if it exists
    constraints = inspector.get_unique_constraints('invoices')
    constraint_names = [c['name'] for c in constraints]
    if 'invoices_invoice_number_key' in constraint_names:
        op.drop_constraint('invoices_invoice_number_key', 'invoices', type_='unique')
    
    # Create new index for invoice_number if it doesn't exist
    indexes = inspector.get_indexes('invoices')
    index_names = [idx['name'] for idx in indexes]
    if 'ix_invoices_invoice_number' not in index_names:
        op.create_index(op.f('ix_invoices_invoice_number'), 'invoices', ['invoice_number'], unique=False)
    
    # Create new composite unique constraint if it doesn't exist
    if 'uix_tenant_vendor_invoice' not in constraint_names:
        op.create_unique_constraint(
            'uix_tenant_vendor_invoice', 
            'invoices', 
            ['organization_id', 'seller_gstin', 'invoice_number']
        )



def downgrade() -> None:
    op.drop_constraint('uix_tenant_vendor_invoice', 'invoices', type_='unique')
    op.drop_index(op.f('ix_invoices_invoice_number'), table_name='invoices')
    op.create_unique_constraint('invoices_invoice_number_key', 'invoices', ['invoice_number'])
