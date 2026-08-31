"""retire_finance_manager_role

Revision ID: 014_retire_finance_manager_role
Revises: 013_widen_integers_and_add_barcode
Create Date: 2026-07-30

Purpose:
    The 'Finance Manager' role was retired from the application's role enum and
    all routing/dashboard code in Phase 2 of the remediation.  However, no data
    migration was written at the time, leaving any users already stored with
    role = 'Finance Manager' in an orphaned state — the role string is no longer
    recognised by the backend or frontend, causing a total login/dashboard lockout
    for those accounts.

    This migration promotes every affected user to 'Approver', which is the closest
    equivalent role in the current role hierarchy (Approver scope covers approve,
    release, confirm-payment — the same financial-closure actions the retired role
    previously handled).

Standing practice:
    Any future role retirement or rename in this codebase MUST include a companion
    data migration step (either here or in a dedicated script) that re-assigns all
    existing rows before the code change ships.  Do not rely on manual one-off
    SQL fixes; make the migration the canonical record of the role change.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '014_retire_finance_manager_role'
down_revision = '013_widen_integers_and_add_barcode'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Migrate all users holding the retired 'Finance Manager' role to 'Approver'.
    # Using a raw SQL UPDATE for clarity and auditability — this is an intentional
    # data fix, not a schema change.
    op.execute(
        sa.text(
            "UPDATE users SET role = 'Approver' WHERE role = 'Finance Manager'"
        )
    )

    # Verify the migration worked — if any Finance Manager rows still exist, fail
    # loudly so the deployment is not silently incomplete.
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE role = 'Finance Manager'")
    ).scalar()

    if result != 0:
        raise RuntimeError(
            f"Migration 014 failed: {result} user(s) still have role='Finance Manager' "
            "after the UPDATE.  Check for constraint issues or concurrent writes."
        )


def downgrade() -> None:
    # NOTE: A downgrade cannot safely recover the original Finance Manager
    # assignments because the role value has been permanently retired from all
    # application code.  Attempting to restore it would leave accounts in the
    # same broken state.  Downgrade is intentionally a no-op; revert via seed or
    # a forward migration if needed.
    pass
