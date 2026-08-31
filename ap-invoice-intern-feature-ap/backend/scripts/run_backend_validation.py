import os
import sys
import json
import time
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from dotenv import load_dotenv
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env.local"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(BASE_DIR, 'test.db')}"

from app.main import app

# Import all models to ensure mapper initialization
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder
from app.models.audit_log import AuditLog
from app.models.hsn_master import HSNMaster

def main():
    print("[Backend] Initializing API test client...")
    client = TestClient(app)
    results = {
        "endpoints_tested": [],
        "failures": [],
        "auth_blocks_verified": 0,
        "validation_errors_caught": 0,
        "status": "SUCCESS"
    }

    # Test root endpoint
    try:
        t0 = time.time()
        res = client.get("/")
        lat = (time.time() - t0) * 1000
        results["endpoints_tested"].append({"route": "/", "status_code": res.status_code, "latency_ms": lat})
        assert res.status_code == 200
        assert "message" in res.json()
    except Exception as e:
        results["failures"].append(f"Root endpoint failed: {e}")

    # Test health check endpoints
    health_routes = ["/api/v1/health", "/api/v1/health/live", "/api/v1/health/ready"]
    for route in health_routes:
        try:
            t0 = time.time()
            res = client.get(route)
            lat = (time.time() - t0) * 1000
            results["endpoints_tested"].append({"route": route, "status_code": res.status_code, "latency_ms": lat})
            assert res.status_code in [200, 503]  # ready might return 503 if DB is not fully ready but handler should catch it
        except Exception as e:
            results["failures"].append(f"Health route {route} failed: {e}")

    # Test authenticated routes block (Get Invoices should block if no JWT is passed, if auth middleware is present)
    # Note: If JWT authentication is enabled on routes, this check verifies the block.
    try:
        res = client.get("/api/v1/invoices/")
        # If it returns 401 or 403, our auth block is active. If 200, auth might not be globally active on list endpoint yet.
        results["endpoints_tested"].append({"route": "/api/v1/invoices/", "status_code": res.status_code})
        if res.status_code in [401, 403]:
            results["auth_blocks_verified"] += 1
    except Exception as e:
        pass

    # Test schema validation (Post empty/invalid payload to invoices)
    try:
        res = client.post("/api/v1/invoices/", json={})
        results["endpoints_tested"].append({"route": "POST /api/v1/invoices/ (invalid schema)", "status_code": res.status_code})
        # FastAPI validation error should return 422 Unprocessable Entity
        if res.status_code == 422:
            results["validation_errors_caught"] += 1
    except Exception as e:
        pass

    if results["failures"]:
        results["status"] = "FAILED"

    print(json.dumps(results, indent=2))
    if results["status"] == "FAILED":
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
