"""Add actor_id to ApprovalHistory, org IDs to logs, and FORCE RLS

Revision ID: 019_enterprise_boundary_fixes
Revises: 018_rls_policies
Create Date: 2026-08-09 12:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "019_enterprise_boundary_fixes"
down_revision = "018_rls_policies"
branch_labels = None
depends_on = None

def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"

def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)

    existing_tables = set(inspector.get_table_names())

    # 1. Add actor_id to approval_histories
    if "approval_histories" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("approval_histories")}
        with op.batch_alter_table("approval_histories") as batch_op:
            if "actor_id" not in cols:
                batch_op.add_column(sa.Column("actor_id", sa.Uuid(), nullable=True))
                batch_op.create_foreign_key(
                    "fk_approval_histories_actor",
                    "users",
                    ["actor_id"],
                    ["id"],
                    ondelete="SET NULL"
                )

    # 2. Add organization_id to erp_sync_logs
    if "erp_sync_logs" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("erp_sync_logs")}
        with op.batch_alter_table("erp_sync_logs") as batch_op:
            if "organization_id" not in cols:
                batch_op.add_column(sa.Column("organization_id", sa.Uuid(), nullable=True, index=True))

    # 3. Add organization_id to failed_tasks
    if "failed_tasks" in existing_tables:
        cols = {c["name"] for c in inspector.get_columns("failed_tasks")}
        with op.batch_alter_table("failed_tasks") as batch_op:
            if "organization_id" not in cols:
                batch_op.add_column(sa.Column("organization_id", sa.Uuid(), nullable=True, index=True))

    # 4. FORCE ROW LEVEL SECURITY on all RLS tables
    if _is_postgres():
        # Force RLS for existing 4 tables
        op.execute("ALTER TABLE invoices FORCE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE payment_schedules FORCE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE approval_rules FORCE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE settings FORCE ROW LEVEL SECURITY;")

        # Enable RLS on new tables
        op.execute("ALTER TABLE erp_sync_logs ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE erp_sync_logs FORCE ROW LEVEL SECURITY;")
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'erp_sync_logs' AND policyname = 'tenant_erp_sync_logs_policy') THEN
                    CREATE POLICY tenant_erp_sync_logs_policy ON erp_sync_logs
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

        op.execute("ALTER TABLE failed_tasks ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE failed_tasks FORCE ROW LEVEL SECURITY;")
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'failed_tasks' AND policyname = 'tenant_failed_tasks_policy') THEN
                    CREATE POLICY tenant_failed_tasks_policy ON failed_tasks
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
    if _is_postgres():
        try:
            op.execute("DROP POLICY IF EXISTS tenant_failed_tasks_policy ON failed_tasks;")
            op.execute("ALTER TABLE failed_tasks DISABLE ROW LEVEL SECURITY;")
            op.execute("ALTER TABLE failed_tasks NO FORCE ROW LEVEL SECURITY;")

            op.execute("DROP POLICY IF EXISTS tenant_erp_sync_logs_policy ON erp_sync_logs;")
            op.execute("ALTER TABLE erp_sync_logs DISABLE ROW LEVEL SECURITY;")
            op.execute("ALTER TABLE erp_sync_logs NO FORCE ROW LEVEL SECURITY;")

            op.execute("ALTER TABLE invoices NO FORCE ROW LEVEL SECURITY;")
            op.execute("ALTER TABLE payment_schedules NO FORCE ROW LEVEL SECURITY;")
            op.execute("ALTER TABLE approval_rules NO FORCE ROW LEVEL SECURITY;")
            op.execute("ALTER TABLE settings NO FORCE ROW LEVEL SECURITY;")
        except Exception:
            pass

    with op.batch_alter_table("failed_tasks") as batch_op:
        batch_op.drop_column("organization_id")
    with op.batch_alter_table("erp_sync_logs") as batch_op:
        batch_op.drop_column("organization_id")
    with op.batch_alter_table("approval_histories") as batch_op:
        batch_op.drop_constraint("fk_approval_histories_actor", type_="foreignkey")
        batch_op.drop_column("actor_id")
