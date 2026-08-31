"""create_tds_rules_table

Revision ID: 009_create_tds_rules_table
Revises: 008_add_password_reset_tokens_table
Create Date: 2026-07-25

"""
from alembic import op
import sqlalchemy as sa
import json
import os
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_create_tds_rules_table'
down_revision = '008_add_password_reset_tokens_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create tds_rules table if not exists
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if 'tds_rules' not in tables:
        op.create_table(
        'tds_rules',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('organization_id', sa.Uuid(), nullable=True),
        sa.Column('section_code', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('rate_with_pan', sa.Float(), nullable=False),
        sa.Column('rate_without_pan', sa.Float(), nullable=False, server_default='20.0'),
        sa.Column('single_threshold', sa.Float(), nullable=False, server_default='30000.0'),
        sa.Column('aggregate_threshold', sa.Float(), nullable=False, server_default='100000.0'),
        sa.Column('vendor_categories', sa.String(), nullable=True),
        sa.Column('expense_categories', sa.String(), nullable=True),
        sa.Column('effective_from', sa.String(), nullable=True),
        sa.Column('effective_to', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_tds_rules_id'), 'tds_rules', ['id'], unique=False)
        op.create_index(op.f('ix_tds_rules_organization_id'), 'tds_rules', ['organization_id'], unique=False)
        op.create_index(op.f('ix_tds_rules_section_code'), 'tds_rules', ['section_code'], unique=False)

        # 2. Seed tds_rules.json file content
        try:
            current_dir = os.path.dirname(os.path.realpath(__file__))
            config_path = os.path.abspath(os.path.join(current_dir, "..", "..", "app", "core", "config", "tds_rules.json"))
            if os.path.exists(config_path):
                with open(config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    rules = data.get("rules", [])
                    
                    # Insert rules into the database as global default fallback (organization_id = NULL)
                    tb = sa.table(
                        'tds_rules',
                        sa.column('section_code', sa.String),
                        sa.column('description', sa.String),
                        sa.column('rate_with_pan', sa.Float),
                        sa.column('rate_without_pan', sa.Float),
                        sa.column('single_threshold', sa.Float),
                        sa.column('aggregate_threshold', sa.Float),
                        sa.column('vendor_categories', sa.String),
                        sa.column('expense_categories', sa.String),
                        sa.column('effective_from', sa.String),
                        sa.column('effective_to', sa.String),
                        sa.column('organization_id', sa.Uuid)
                    )
                    
                    for r in rules:
                        op.execute(
                            tb.insert().values(
                                section_code=r.get("section_code"),
                                description=r.get("description"),
                                rate_with_pan=float(r.get("rate_with_pan", 0.0)),
                                rate_without_pan=float(r.get("rate_without_pan", 20.0)),
                                single_threshold=float(r.get("single_threshold", 30000.0)),
                                aggregate_threshold=float(r.get("aggregate_threshold", 100000.0)),
                                vendor_categories=json.dumps(r.get("vendor_categories", [])),
                                expense_categories=json.dumps(r.get("expense_categories", [])),
                                effective_from=r.get("effective_from"),
                                effective_to=r.get("effective_to"),
                                organization_id=None
                            )
                        )
        except Exception as e:
            print(f"Failed to seed TDS rules: {e}")


def downgrade() -> None:
    op.drop_index(op.f('ix_tds_rules_section_code'), table_name='tds_rules')
    op.drop_index(op.f('ix_tds_rules_organization_id'), table_name='tds_rules')
    op.drop_index(op.f('ix_tds_rules_id'), table_name='tds_rules')
    op.drop_table('tds_rules')
