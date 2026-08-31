import os
import sys
import unittest
from uuid import uuid4
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from app.main import app
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.models.payment import PaymentSchedule
from app.core.security.hashing import hash_password
from datetime import date, timedelta
from app.core.security.jwt import create_access_token

class TenantIsolationRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = next(get_db())

        # Setup Tenant A
        suffix_a = uuid4().hex[:6].upper()
        cls.org_a = Organization(id=uuid4(), name=f"Tenant A {suffix_a}", code=f"TA{suffix_a}", status="Active")
        cls.db.add(cls.org_a)
        cls.db.commit()

        cls.user_a = User(
            id=uuid4(),
            email=f"approver_{suffix_a}@tenanta.com",
            name="Approver A",
            role="Approver",
            organization_id=cls.org_a.id,
            password_hash=hash_password("password123"),
            is_active=True,
            status="Active"
        )
        cls.db.add(cls.user_a)
        cls.db.commit()

        # Setup Tenant B
        suffix_b = uuid4().hex[:6].upper()
        cls.org_b = Organization(id=uuid4(), name=f"Tenant B {suffix_b}", code=f"TB{suffix_b}", status="Active")
        cls.db.add(cls.org_b)
        cls.db.commit()

        cls.user_b = User(
            id=uuid4(),
            email=f"approver_{suffix_b}@tenantb.com",
            name="Approver B",
            role="Approver",
            organization_id=cls.org_b.id,
            password_hash=hash_password("password123"),
            is_active=True,
            status="Active"
        )
        cls.db.add(cls.user_b)
        cls.db.commit()

        # Setup Tenant B Invoice and Payment
        cls.invoice_b = Invoice(
            organization_id=cls.org_b.id,
            invoice_number=f"INV-TENB-{suffix_b}",
            seller_name="Vendor B",
            total_invoice_value=12000.0,
            workflow_status=InvoiceWorkflowStatus.pending_approval
        )
        cls.db.add(cls.invoice_b)
        cls.db.commit()

        cls.payment_b = PaymentSchedule(
            invoice_id=cls.invoice_b.id,
            due_date=date.today() + timedelta(days=10),
            total_amount=12000.0,
            outstanding_balance=12000.0,
            status="Awaiting Scheduling"
        )
        cls.db.add(cls.payment_b)
        cls.db.commit()

        # Generate tokens
        cls.token_a = create_access_token(data={"user_id": str(cls.user_a.id), "email": cls.user_a.email, "role": "Approver", "organization_id": str(cls.org_a.id)})
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}

    @classmethod
    def tearDownClass(cls):
        # Cleanup test entries
        cls.db.delete(cls.payment_b)
        cls.db.delete(cls.invoice_b)
        cls.db.delete(cls.user_a)
        cls.db.delete(cls.user_b)
        cls.db.delete(cls.org_a)
        cls.db.delete(cls.org_b)
        cls.db.commit()

    def test_tenant_a_cannot_read_tenant_b_payments(self):
        # Attempt to read Tenant B's payments in the queue
        response = self.client.get("/api/v1/payments/queue", headers=self.headers_a)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # Verify Tenant B's payment is not leaked to Tenant A
        invoice_ids = [p["invoice_id"] for p in data]
        self.assertNotIn(self.invoice_b.id, invoice_ids)

    def test_tenant_a_cannot_execute_tenant_b_payments(self):
        # Attempt to execute Tenant B's payment using Tenant A credentials
        response = self.client.post(f"/api/v1/payments/{self.payment_b.id}/execute", headers=self.headers_a)
        self.assertEqual(response.status_code, 404)  # Resource not visible, yields 404

    def test_tenant_a_cannot_approve_tenant_b_invoice(self):
        payload = {
            "invoice_id": self.invoice_b.id,
            "reason": "Malicious approval attempt",
            "actor": "Approver A"
        }
        response = self.client.post("/api/v1/workflow/approve", json=payload, headers=self.headers_a)
        self.assertEqual(response.status_code, 403)

if __name__ == "__main__":
    unittest.main()
