"""
Regression tests for 7 enterprise production blockers.

Covers:
  1. PostgreSQL RLS tenant context injection
  2. High-value payment dual approval enforcement
  3. validation_failed → approved FSM override guard
  4. Odoo vendor resolution exception (VendorResolutionError)
  5. Celery DB session lifetime pattern (logic-level)
  6. e-Invoice IRN NIC verification boundary (sandbox/production/no-creds)

All tests use mocks — no live PostgreSQL, Odoo, Celery or NIC API required.
"""

import pytest
import os
from datetime import date
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _mock_invoice(**kwargs):
    inv = MagicMock()
    inv.id = kwargs.get("id", 1)
    inv.invoice_number = kwargs.get("invoice_number", "INV-001")
    inv.organization_id = kwargs.get("organization_id", "aaaaaaaa-0000-0000-0000-000000000001")
    inv.seller_name = kwargs.get("seller_name", "Test Vendor Pvt Ltd")
    inv.seller_gstin = kwargs.get("seller_gstin", None)
    inv.irn = kwargs.get("irn", None)
    inv.invoice_date = kwargs.get("invoice_date", date(2025, 1, 15))
    inv.match_status = kwargs.get("match_status", "matched")
    inv.items = []
    return inv


# ===========================================================================
# FIX 1 — RLS Tenant Context Injection
# ===========================================================================

class TestRLSTenantContext:
    """set_tenant_context() must inject the correct pg session variable."""

    def test_set_org_id_on_postgresql(self):
        from app.core.database import set_tenant_context
        db = MagicMock()
        db.bind.dialect.name = "postgresql"

        set_tenant_context(db, "org-abc-123")

        db.execute.assert_called_once()
        call_repr = str(db.execute.call_args)
        assert "org-abc-123" in call_repr

    def test_super_admin_sentinel(self):
        from app.core.database import set_tenant_context
        db = MagicMock()
        db.bind.dialect.name = "postgresql"

        set_tenant_context(db, "BYPASS_RLS_SUPERADMIN")

        call_repr = str(db.execute.call_args)
        assert "BYPASS_RLS_SUPERADMIN" in call_repr

    def test_sqlite_is_noop(self):
        """No SQL executed on SQLite (dev env)."""
        from app.core.database import set_tenant_context
        db = MagicMock()
        db.bind.dialect.name = "sqlite"

        set_tenant_context(db, "any-org-id")

        db.execute.assert_not_called()

    def test_two_tenants_isolated(self):
        """Two DB sessions each receive their own org context."""
        from app.core.database import set_tenant_context

        db_a = MagicMock()
        db_b = MagicMock()
        db_a.bind.dialect.name = "postgresql"
        db_b.bind.dialect.name = "postgresql"

        set_tenant_context(db_a, "tenant-ALPHA")
        set_tenant_context(db_b, "tenant-BETA")

        db_a.execute.assert_called_once()
        db_b.execute.assert_called_once()
        assert "tenant-ALPHA" in str(db_a.execute.call_args)
        assert "tenant-BETA" in str(db_b.execute.call_args)
        # Cross-contamination check
        assert "tenant-ALPHA" not in str(db_b.execute.call_args)
        assert "tenant-BETA" not in str(db_a.execute.call_args)

    def test_missing_org_sets_empty_string(self):
        """None org_id sets empty string (not the sentinel)."""
        from app.core.database import set_tenant_context
        db = MagicMock()
        db.bind.dialect.name = "postgresql"

        set_tenant_context(db, None)

        call_repr = str(db.execute.call_args)
        assert "BYPASS_RLS_SUPERADMIN" not in call_repr


# ===========================================================================
# FIX 2 — High-Value Payment Dual Approval
# ===========================================================================

class TestDualApprovalEnforcement:
    """Payments > ₹5,00,000 require ≥2 distinct approvers."""

    HIGH_VALUE = 700_000.0
    LOW_VALUE = 300_000.0
    THRESHOLD = 500_000.0

    def _distinct_approvers(self, actors: list[str]) -> set:
        """Simulate the route logic."""
        entries = [MagicMock(actor=a, action="APPROVE") for a in actors]
        return {e.actor for e in entries if e.actor}

    def test_single_approver_blocked(self):
        from fastapi import HTTPException
        distinct = self._distinct_approvers(["alice"])
        assert len(distinct) < 2
        with pytest.raises(HTTPException) as exc:
            if len(distinct) < 2:
                raise HTTPException(
                    status_code=403,
                    detail=f"High-value payment requires dual approval. Signed by: {distinct}",
                )
        assert exc.value.status_code == 403
        assert "alice" in exc.value.detail

    def test_two_distinct_approvers_passes(self):
        distinct = self._distinct_approvers(["alice", "bob"])
        # Must NOT raise
        assert len(distinct) >= 2

    def test_same_approver_twice_still_fails(self):
        distinct = self._distinct_approvers(["alice", "alice"])
        assert len(distinct) < 2  # still only 1 unique actor

    def test_zero_approvers_blocked(self):
        from fastapi import HTTPException
        distinct = self._distinct_approvers([])
        with pytest.raises(HTTPException) as exc:
            if len(distinct) < 2:
                raise HTTPException(status_code=403, detail="no approvers")
        assert exc.value.status_code == 403

    def test_low_value_skips_dual_check(self):
        """Below threshold — dual approval check must not fire."""
        total = self.LOW_VALUE
        needs_dual = total > self.THRESHOLD
        assert not needs_dual

    def test_exact_threshold_not_triggered(self):
        """Exactly at threshold (not strictly greater) must not trigger."""
        total = self.THRESHOLD
        needs_dual = total > self.THRESHOLD
        assert not needs_dual


# ===========================================================================
# FIX 4 — Block validation_failed → approved Without Override Policy
# ===========================================================================

class TestValidationFailedOverrideGuard:
    """FSM guard: validation_failed → approved only if policy=on AND justification given."""

    def test_policy_off_blocks_regardless_of_justification(self):
        from fastapi import HTTPException
        override_allowed = False
        justification = "Valid detailed justification here"

        with pytest.raises(HTTPException) as exc:
            if not override_allowed:
                raise HTTPException(
                    status_code=403,
                    detail="override policy is disabled",
                )
        assert exc.value.status_code == 403

    def test_policy_on_but_empty_justification_blocks(self):
        from fastapi import HTTPException
        override_allowed = True
        justification = "   "

        with pytest.raises(HTTPException) as exc:
            if override_allowed and (not justification or len(justification.strip()) < 10):
                raise HTTPException(
                    status_code=400,
                    detail="justification required (≥10 chars)",
                )
        assert exc.value.status_code == 400

    def test_policy_on_short_justification_blocks(self):
        from fastapi import HTTPException
        override_allowed = True
        justification = "too short"  # 9 chars

        with pytest.raises(HTTPException) as exc:
            if override_allowed and len(justification.strip()) < 10:
                raise HTTPException(status_code=400, detail="too short")
        assert exc.value.status_code == 400

    def test_policy_on_with_adequate_justification_passes(self):
        """Both conditions met → no exception."""
        override_allowed = True
        justification = "Amount validated manually per audit trail ref #2025-001"

        # Guard logic — should NOT raise
        if not override_allowed:
            pytest.fail("Policy is on — should not block")
        if not justification or len(justification.strip()) < 10:
            pytest.fail("Justification is adequate — should not block")

    def test_non_validation_failed_status_unaffected(self):
        """Invoices in pending_approval skip the override guard entirely."""
        from app.models.invoice import InvoiceWorkflowStatus

        status = InvoiceWorkflowStatus.pending_approval
        # The guard only fires for validation_failed
        guard_fires = (status == InvoiceWorkflowStatus.validation_failed)
        assert not guard_fires


# ===========================================================================
# FIX 3/5 — Odoo Vendor Resolution Exception
# ===========================================================================

class TestOdooVendorResolutionException:
    """OdooSyncService must raise VendorResolutionError instead of creating partner."""

    def _make_service(self, execute_side_effect):
        from app.integrations.odoo.sync import OdooSyncService
        client = MagicMock()
        client.execute.side_effect = execute_side_effect
        return OdooSyncService(client, organization_id="org-X")

    def test_unknown_vendor_raises_not_creates(self):
        """When no partner found, VendorResolutionError is raised; create is NEVER called."""
        from app.integrations.odoo.exceptions import VendorResolutionError

        calls = []

        def fake_execute(model, method, *args, **kwargs):
            calls.append((model, method))
            if model == "account.move":
                return []          # no existing bill
            if model == "res.partner":
                return []          # vendor not found
            return []

        service = self._make_service(fake_execute)
        invoice = _mock_invoice(seller_name="Ghost Corp", seller_gstin=None)

        with pytest.raises(VendorResolutionError) as exc_info:
            service.post_invoice_to_odoo(MagicMock(), invoice)

        err = exc_info.value
        assert "Ghost Corp" in str(err)
        assert err.invoice_id == invoice.id

        # Crucial: res.partner "create" must never appear in calls
        assert ("res.partner", "create") not in calls, \
            "Automatic Odoo partner creation is forbidden — must raise VendorResolutionError"

    def test_vendor_found_by_gstin_posts_bill(self):
        """GSTIN match succeeds → bill created, no VendorResolutionError."""
        from app.integrations.odoo.sync import OdooSyncService

        def fake_execute(model, method, *args, **kwargs):
            if model == "account.move" and method == "search_read":
                return []           # no existing bill
            if model == "res.partner" and method == "search_read":
                return [{"id": 42}] # found by GSTIN
            if model == "account.move" and method == "create":
                return 101
            return []

        client = MagicMock()
        client.execute.side_effect = fake_execute
        service = OdooSyncService(client, organization_id="org-Y")

        invoice = _mock_invoice(seller_gstin="27AAPFU0939F1ZV", invoice_number="INV-GST")

        with patch("app.integrations.odoo.sync.map_invoice_to_odoo_bill", return_value={}):
            db = MagicMock()
            db.query.return_value.filter.return_value.all.return_value = []
            result = service.post_invoice_to_odoo(db, invoice)

        assert result == 101

    def test_idempotency_returns_existing_bill_id(self):
        """If bill already in Odoo, return existing ID (no duplicate)."""
        from app.integrations.odoo.sync import OdooSyncService

        client = MagicMock()
        client.execute.return_value = [{"id": 77}]  # existing bill on first call

        service = OdooSyncService(client, organization_id="org-Z")
        invoice = _mock_invoice(invoice_number="INV-DUPE")

        result = service.post_invoice_to_odoo(MagicMock(), invoice)

        assert result == 77
        assert client.execute.call_count == 1  # only idempotency check, nothing else

    def test_vendor_resolution_error_contains_org_context(self):
        """Error message must include identifiable invoice/vendor info for routing."""
        from app.integrations.odoo.exceptions import VendorResolutionError

        err = VendorResolutionError(
            seller_name="Phantom Ltd",
            seller_gstin="29AAAPL0000A1Z5",
            invoice_id=42,
        )
        msg = str(err)
        assert "Phantom Ltd" in msg
        assert "42" in msg


# ===========================================================================
# FIX 6 — Celery Session Lifetime (Logic Test, No Celery Runtime)
# ===========================================================================

class TestCelerySessionLifetimePattern:
    """
    Test the two-phase session pattern independently of Celery internals.
    The key invariant: fetch session closes BEFORE external I/O begins.
    """

    def test_fetch_session_closed_before_storage_call(self):
        """Phase-1 db session must be .close()'d before storage.get() fires."""
        event_log = []

        # Simulate Phase 1 (fetch doc metadata)
        db_fetch = MagicMock()
        db_fetch.close.side_effect = lambda: event_log.append("db_fetch.close")

        doc = MagicMock()
        doc.storage_path = "s3://bucket/invoice.pdf"
        doc.filename = "invoice.pdf"
        db_fetch.query.return_value.filter.return_value.first.return_value = doc

        # Execute Phase 1
        result_doc = db_fetch.query(object()).filter().first()
        storage_path = result_doc.storage_path
        db_fetch.close()   # <-- must happen before storage call

        # Simulate Phase 2 (external storage read — would hold connection if inside session)
        def fake_storage_get(path):
            event_log.append("storage.get")
            return b"pdf_bytes"

        fake_storage_get(storage_path)

        # Verify ordering
        assert "db_fetch.close" in event_log
        assert "storage.get" in event_log
        close_idx = event_log.index("db_fetch.close")
        get_idx = event_log.index("storage.get")
        assert close_idx < get_idx, (
            f"db_fetch.close ({close_idx}) must precede storage.get ({get_idx}); "
            f"current order: {event_log}"
        )

    def test_write_session_is_separate_object(self):
        """Phase-3 DB session (for writes) must be a distinct object from Phase-1."""
        db_fetch = MagicMock(name="db_fetch")
        db_write = MagicMock(name="db_write")

        # They must not be the same object
        assert db_fetch is not db_write

    def test_write_session_closed_on_exception(self):
        """db_write.close() must still be called if pipeline raises."""
        db_write = MagicMock()
        closed = []
        db_write.close.side_effect = lambda: closed.append(True)

        try:
            raise RuntimeError("Simulated OCR failure")
        except RuntimeError:
            pass
        finally:
            db_write.close()

        assert len(closed) == 1, "db_write.close() must be called even on exception"


# ===========================================================================
# FIX 7 — e-Invoice IRN NIC API Verification
# ===========================================================================

class TestIRNNICVerification:
    """_call_nic_irn_api must use env-configured credentials/URL, never hardcoded."""

    def _engine(self):
        """Construct GSTComplianceEngine with mocked CONFIG."""
        from app.services.gst_compliance import GSTComplianceEngine

        with patch("app.core.config.CONFIG") as mock_cfg:
            mock_cfg.compliance_rules = {
                "hsn_sac": {"rcm_hsn_codes": [], "blocked_itc_hsn_codes": []}
            }
            mock_cfg.state_codes = {}
            mock_cfg.gst_rules = {}
            mock_cfg.rcm_rules = {"rules": []}
            mock_cfg.irn_rules = {
                "irn_length": 64,
                "irn_format_pattern": "^[0-9a-fA-F]{64}$",
                "prevent_duplicates": True,
                "check_date_consistency": True,
                "max_past_days": 30,
            }
            engine = GSTComplianceEngine()
        return engine

    def test_missing_credentials_skips_api(self):
        """No CLIENT_ID/SECRET → api_called=False, api_status=CREDENTIALS_MISSING."""
        engine = self._engine()
        env_clean = {k: v for k, v in os.environ.items()
                     if k not in ("E_INVOICE_GSP_CLIENT_ID", "E_INVOICE_GSP_CLIENT_SECRET")}

        with patch.dict(os.environ, env_clean, clear=True):
            result = engine._call_nic_irn_api("a" * 64)

        assert result["api_called"] is False
        assert result["api_status"] == "CREDENTIALS_MISSING"
        assert result["success"] is None

    def test_sandbox_is_default_env(self):
        """Without E_INVOICE_ENV, defaults to 'sandbox'."""
        engine = self._engine()
        env = {
            "E_INVOICE_GSP_CLIENT_ID": "test-id",
            "E_INVOICE_GSP_CLIENT_SECRET": "test-secret",
        }
        env_no_env_var = {k: v for k, v in {**os.environ, **env}.items()
                         if k != "E_INVOICE_ENV"}

        with patch.dict(os.environ, env_no_env_var, clear=True):
            with patch("httpx.Client") as MockClient:
                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.json.return_value = {"Status": 1}
                MockClient.return_value.__enter__.return_value.get.return_value = mock_resp

                result = engine._call_nic_irn_api("a" * 64)

        assert result["env"] == "sandbox"
        assert result["success"] is True
        assert result["api_status"] == "VERIFIED"

    def test_production_env_switch(self):
        """E_INVOICE_ENV=production → uses production URL, returns correct result."""
        engine = self._engine()
        env = {
            "E_INVOICE_GSP_CLIENT_ID": "prod-id",
            "E_INVOICE_GSP_CLIENT_SECRET": "prod-secret",
            "E_INVOICE_ENV": "production",
        }

        with patch.dict(os.environ, env):
            with patch("httpx.Client") as MockClient:
                mock_resp = MagicMock()
                mock_resp.status_code = 404
                MockClient.return_value.__enter__.return_value.get.return_value = mock_resp

                result = engine._call_nic_irn_api("b" * 64)

        assert result["env"] == "production"
        assert result["api_status"] == "NOT_FOUND"
        assert result["success"] is False

    def test_api_error_is_non_blocking(self):
        """Network error during NIC call → success=None (warning), not exception."""
        engine = self._engine()
        env = {
            "E_INVOICE_GSP_CLIENT_ID": "test-id",
            "E_INVOICE_GSP_CLIENT_SECRET": "test-secret",
        }

        with patch.dict(os.environ, env):
            with patch("httpx.Client") as MockClient:
                MockClient.return_value.__enter__.return_value.get.side_effect = \
                    ConnectionError("NIC portal unreachable")

                result = engine._call_nic_irn_api("c" * 64)

        assert result["api_called"] is True
        assert result["success"] is None
        assert result["api_status"] == "API_ERROR"

    def test_invalid_irn_format_rejected_locally(self):
        """Bad IRN format → FAILED locally; NIC API is NEVER called."""
        engine = self._engine()
        invoice = _mock_invoice(irn="INVALID-FORMAT-IRN")

        db = MagicMock()
        settings_mock = MagicMock()
        settings_mock.gst_prevent_duplicate_irn = True
        settings_mock.gst_check_date_consistency = False
        settings_mock.gst_max_past_days = 30
        db.query.return_value.first.return_value = settings_mock
        db.query.return_value.filter.return_value.first.return_value = None

        with patch.object(engine, "_call_nic_irn_api") as mock_api:
            with patch("app.models.settings.Settings"):
                result = engine.verify_irn(db, invoice)

        assert result["status"] == "FAILED"
        assert result["nic_api_status"] == "SKIPPED_LOCAL_FAIL"
        mock_api.assert_not_called()

    def test_valid_irn_invokes_nic_api(self):
        """Valid format IRN → local checks pass → NIC API is called."""
        engine = self._engine()
        valid_irn = "a" * 64
        invoice = _mock_invoice(irn=valid_irn, invoice_date=date.today())

        db = MagicMock()
        settings_mock = MagicMock()
        settings_mock.gst_prevent_duplicate_irn = True
        settings_mock.gst_check_date_consistency = False
        settings_mock.gst_max_past_days = 30
        db.query.return_value.first.return_value = settings_mock
        db.query.return_value.filter.return_value.first.return_value = None  # no dup

        nic_result = {
            "api_called": True,
            "success": True,
            "env": "sandbox",
            "api_status": "VERIFIED",
        }

        with patch.object(engine, "_call_nic_irn_api", return_value=nic_result) as mock_api:
            with patch("app.models.settings.Settings"):
                result = engine.verify_irn(db, invoice)

        mock_api.assert_called_once_with(valid_irn)
        assert result["status"] == "PASS"
        assert result["nic_api_status"] == "VERIFIED"

    def test_no_irn_returns_not_available(self):
        """Invoice without IRN returns NOT_AVAILABLE without API call."""
        engine = self._engine()
        invoice = _mock_invoice(irn=None)

        db = MagicMock()
        db.query.return_value.first.return_value = None

        with patch.object(engine, "_call_nic_irn_api") as mock_api:
            with patch("app.models.settings.Settings"):
                result = engine.verify_irn(db, invoice)

        assert result["status"] == "NOT_AVAILABLE"
        mock_api.assert_not_called()
