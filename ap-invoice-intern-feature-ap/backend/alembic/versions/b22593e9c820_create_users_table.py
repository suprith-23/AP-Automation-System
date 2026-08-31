"""create_users_table

Revision ID: b22593e9c820
Revises: 005_add_hsn_rate_breakdown
Create Date: 2026-07-08 13:49:55.878790

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b22593e9c820'
down_revision = '005_add_hsn_rate_breakdown'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the new users table only
    op.create_table('users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('designation', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('users_pkey'))
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)


def downgrade() -> None:
    # Drop the users table
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
