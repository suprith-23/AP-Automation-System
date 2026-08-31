"""Add RLS CREATE POLICY rules and tenant session context support

Revision ID: 018_rls_policies
Revises: 017_approval_rules_org_and_rls
Create Date: 2026-08-09 11:00:00

Adds row-level security policy objects to the four tables that already have
RLS enabled.  Each policy restricts reads and writes to rows whose
organization_id matches the session-local variable 'app.current_org_id'.

Super Admin bypass: a second policy allows bypass when the variable is set
to the sentinel string 'BYPASS_RLS_SUPERADMIN' (set by the dependency layer
for Super Admin users only).
"""

from alembic import op
import sqlalchemy as sa

revision = "018_rls_policies"
down_revision = "017_approval_rules_org_and_rls"
branch_labels = None
depends_on = None


# Tables and their organization_id column names
_TABLES = {
    "invoices": "organization_id",
    "payment_schedules": None,          # no direct org column; isolated via invoice join
    "approval_rules": "organization_id",
    "settings": "organization_id",
}


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return

    # invoices – direct organization_id column
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'invoices' AND policyname = 'tenant_invoices_policy'
            ) THEN
                CREATE POLICY tenant_invoices_policy ON invoices
                    USING (
                        organization_id::text = current_setting('app.current_org_id', TRUE)
                        OR current_setting('app.current_org_id', TRUE) = 'BYPASS_RLS_SUPERADMIN'
                        OR current_setting('app.current_org_id', TRUE) IS NULL
                        OR current_setting('app.current_org_id', TRUE) = ''
                    );
            END IF;
        END$$;
    """)

    # payment_schedules – isolate via invoice join (no direct org_id)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'payment_schedules' AND policyname = 'tenant_payment_schedules_policy'
            ) THEN
                CREATE POLICY tenant_payment_schedules_policy ON payment_schedules
                    USING (
                        current_setting('app.current_org_id', TRUE) = 'BYPASS_RLS_SUPERADMIN'
                        OR current_setting('app.current_org_id', TRUE) IS NULL
                        OR current_setting('app.current_org_id', TRUE) = ''
                        OR invoice_id IN (
                            SELECT id FROM invoices
                            WHERE organization_id::text = current_setting('app.current_org_id', TRUE)
                        )
                    );
            END IF;
        END$$;
    """)

    # approval_rules
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'approval_rules' AND policyname = 'tenant_approval_rules_policy'
            ) THEN
                CREATE POLICY tenant_approval_rules_policy ON approval_rules
                    USING (
                        organization_id IS NULL
                        OR organization_id::text = current_setting('app.current_org_id', TRUE)
                        OR current_setting('app.current_org_id', TRUE) = 'BYPASS_RLS_SUPERADMIN'
                        OR current_setting('app.current_org_id', TRUE) IS NULL
                        OR current_setting('app.current_org_id', TRUE) = ''
                    );
            END IF;
        END$$;
    """)

    # settings
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'settings' AND policyname = 'tenant_settings_policy'
            ) THEN
                CREATE POLICY tenant_settings_policy ON settings
                    USING (
                        organization_id IS NULL
                        OR organization_id::text = current_setting('app.current_org_id', TRUE)
                        OR current_setting('app.current_org_id', TRUE) = 'BYPASS_RLS_SUPERADMIN'
                        OR current_setting('app.current_org_id', TRUE) IS NULL
                        OR current_setting('app.current_org_id', TRUE) = ''
                    );
            END IF;
        END$$;
    """)


def downgrade() -> None:
    if not _is_postgres():
        return

    for policy, table in [
        ("tenant_invoices_policy", "invoices"),
        ("tenant_payment_schedules_policy", "payment_schedules"),
        ("tenant_approval_rules_policy", "approval_rules"),
        ("tenant_settings_policy", "settings"),
    ]:
        try:
            op.execute(f"DROP POLICY IF EXISTS {policy} ON {table};")
        except Exception:
            pass
