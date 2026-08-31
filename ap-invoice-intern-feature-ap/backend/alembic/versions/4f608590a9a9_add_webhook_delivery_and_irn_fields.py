"""Add Webhook Delivery and IRN Fields

Revision ID: 4f608590a9a9
Revises: 019_enterprise_boundary_fixes
Create Date: 2026-08-09 12:51:46.237706

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '4f608590a9a9'
down_revision = '019_enterprise_boundary_fixes'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Create webhook_deliveries table
    op.create_table('webhook_deliveries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('delivery_id', sa.String(), nullable=False),
        sa.Column('event_id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=True),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('attempt', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('response_code', sa.Integer(), nullable=True),
        sa.Column('response_body_summary', sa.String(), nullable=True),
        sa.Column('latency_ms', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_webhook_deliveries_delivery_id'), 'webhook_deliveries', ['delivery_id'], unique=True)
    op.create_index(op.f('ix_webhook_deliveries_event_id'), 'webhook_deliveries', ['event_id'], unique=False)
    op.create_index(op.f('ix_webhook_deliveries_event_type'), 'webhook_deliveries', ['event_type'], unique=False)
    op.create_index(op.f('ix_webhook_deliveries_id'), 'webhook_deliveries', ['id'], unique=False)
    op.create_index(op.f('ix_webhook_deliveries_status'), 'webhook_deliveries', ['status'], unique=False)
    op.create_index(op.f('ix_webhook_deliveries_tenant_id'), 'webhook_deliveries', ['tenant_id'], unique=False)

    # 2. Add IRN Fields to Invoices
    op.add_column('invoices', sa.Column('irn_verification_status', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('irn_verification_message', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('irn_verified_at', sa.DateTime(), nullable=True))
    op.add_column('invoices', sa.Column('irn_reference_id', sa.String(), nullable=True))

    # 3. Add Webhook and Notification fields to Settings
    op.add_column('settings', sa.Column('webhook_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('settings', sa.Column('webhook_url', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('webhook_secret', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('webhook_events', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('settings', sa.Column('webhook_provider', sa.String(), nullable=False, server_default='INTERNAL_SANDBOX'))
    op.add_column('settings', sa.Column('discord_webhook_url', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('notification_events', sa.JSON(), nullable=False, server_default='[]'))


def downgrade() -> None:
    op.drop_column('settings', 'notification_events')
    op.drop_column('settings', 'discord_webhook_url')
    op.drop_column('settings', 'webhook_provider')
    op.drop_column('settings', 'webhook_events')
    op.drop_column('settings', 'webhook_secret')
    op.drop_column('settings', 'webhook_url')
    op.drop_column('settings', 'webhook_enabled')
    op.drop_column('invoices', 'irn_reference_id')
    op.drop_column('invoices', 'irn_verified_at')
    op.drop_column('invoices', 'irn_verification_message')
    op.drop_column('invoices', 'irn_verification_status')
    op.drop_index(op.f('ix_webhook_deliveries_tenant_id'), table_name='webhook_deliveries')
    op.drop_index(op.f('ix_webhook_deliveries_status'), table_name='webhook_deliveries')
    op.drop_index(op.f('ix_webhook_deliveries_id'), table_name='webhook_deliveries')
    op.drop_index(op.f('ix_webhook_deliveries_event_type'), table_name='webhook_deliveries')
    op.drop_index(op.f('ix_webhook_deliveries_event_id'), table_name='webhook_deliveries')
    op.drop_index(op.f('ix_webhook_deliveries_delivery_id'), table_name='webhook_deliveries')
    op.drop_table('webhook_deliveries')
