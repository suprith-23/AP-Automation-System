import os
import sys
import json
import time
from fastapi.testclient import TestClient

# Setup path to import app packages
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from dotenv import load_dotenv
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env.local"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(BASE_DIR, 'test.db')}"

from app.core.database import SessionLocal
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder
from app.models.audit_log import AuditLog
from app.models.hsn_master import HSNMaster
from app.main import app

def main():
    print("[Performance] Running system latency benchmarks...")
    db = SessionLocal()
    client = TestClient(app)
    results = {
        "db_latency_ms": 0.0,
        "api_health_latency_ms": 0.0,
        "api_dashboard_latency_ms": 0.0,
        "ocr_sim_latency_ms": 0.0,
        "status": "SUCCESS"
    }

    try:
        # 1. Benchmark DB Connection & simple Query
        t0 = time.time()
        db.execute(text("SELECT 1"))
        results["db_latency_ms"] = (time.time() - t0) * 1000

        # 2. Benchmark API Health checks
        t0 = time.time()
        client.get("/health")
        results["api_health_latency_ms"] = (time.time() - t0) * 1000

        # 3. Benchmark Dashboard load
        t0 = time.time()
        client.get("/dashboard/summary")
        results["api_dashboard_latency_ms"] = (time.time() - t0) * 1000

        # 4. Benchmark OCR processing simulator
        t0 = time.time()
        # Mock OCR delay simulating RapidOCR engine execution time
        time.sleep(0.05)
        results["ocr_sim_latency_ms"] = (time.time() - t0) * 1000

    except Exception as e:
        results["status"] = "FAILED"
        results["error"] = str(e)
    finally:
        db.close()

    print(json.dumps(results, indent=2))
    if results["status"] == "FAILED":
        sys.exit(1)
    else:
        sys.exit(0)

# Import text utility in case database module executes direct text calls
from sqlalchemy import text

if __name__ == "__main__":
    main()
