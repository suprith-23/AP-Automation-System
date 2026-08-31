"""Add vendor and bank details

Revision ID: 020_add_vendor_and_bank_details
Revises: 4f608590a9a9
Create Date: 2026-08-14 12:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "020_add_vendor_and_bank_details"
down_revision = "4f608590a9a9"
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = set(inspector.get_table_names())

    # 1. Create vendors table if not exists
    if "vendors" not in tables:
        op.create_table(
            "vendors",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("bank_account_number", sa.String(), nullable=True),
            sa.Column("ifsc_code", sa.String(), nullable=True),
            sa.Column("bank_name", sa.String(), nullable=True),
            sa.Column("organization_id", sa.Uuid(), nullable=True),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id")
        )

    # 2. Add columns to invoices table if not exists
    invoice_cols = {c["name"] for c in inspector.get_columns("invoices")}
    with op.batch_alter_table("invoices") as batch_op:
        if "bank_account_number" not in invoice_cols:
            batch_op.add_column(sa.Column("bank_account_number", sa.String(), nullable=True))
        if "ifsc_code" not in invoice_cols:
            batch_op.add_column(sa.Column("ifsc_code", sa.String(), nullable=True))
        if "bank_name" not in invoice_cols:
            batch_op.add_column(sa.Column("bank_name", sa.String(), nullable=True))
        if "vendor_id" not in invoice_cols:
            batch_op.add_column(sa.Column("vendor_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_invoices_vendor",
                "vendors",
                ["vendor_id"],
                ["id"],
                ondelete="SET NULL"
            )

def downgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = set(inspector.get_table_names())

    invoice_cols = {c["name"] for c in inspector.get_columns("invoices")}
    with op.batch_alter_table("invoices") as batch_op:
        if "vendor_id" in invoice_cols:
            batch_op.drop_constraint("fk_invoices_vendor", type_="foreignkey")
            batch_op.drop_column("vendor_id")
        if "bank_name" in invoice_cols:
            batch_op.drop_column("bank_name")
        if "ifsc_code" in invoice_cols:
            batch_op.drop_column("ifsc_code")
        if "bank_account_number" in invoice_cols:
            batch_op.drop_column("bank_account_number")

    if "vendors" in tables:
        op.drop_table("vendors")
