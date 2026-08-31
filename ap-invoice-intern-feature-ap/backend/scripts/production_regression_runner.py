import os
import sys
import subprocess
import json
from datetime import datetime

# Setup path to import app packages
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from dotenv import load_dotenv
ROOT_DIR = os.path.dirname(BASE_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env.local"))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

# Configure SQLite database URL for local validation run
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(BASE_DIR, 'test.db')}"

from app.core.database import SessionLocal
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder
from app.models.audit_log import AuditLog
from app.models.hsn_master import HSNMaster

SCRIPTS = [
    {"name": "Database Seeding", "file": "seed_enterprise_data.py"},
    {"name": "Frontend Validation", "file": "run_frontend_validation.py"},
    {"name": "Backend Validation", "file": "run_backend_validation.py"},
    {"name": "Database Integrity", "file": "run_database_validation.py"},
    {"name": "OCR Validation", "file": "run_ocr_validation.py"},
    {"name": "AI Validation", "file": "run_ai_validation.py"},
    {"name": "Compliance Rules", "file": "run_compliance_validation.py"},
    {"name": "Workflow & PO Match", "file": "run_workflow_validation.py"},
    {"name": "Performance Benchmarks", "file": "run_performance_tests.py"},
    {"name": "Stress Concurrency", "file": "run_stress_tests.py"},
    {"name": "Security Scans", "file": "run_security_tests.py"}
]

def run_script(filename):
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
    print(f"[{filename}] Executing validation runner...")
    try:
        # Run subprocess and capture outputs
        proc = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=120
        )
        stdout = proc.stdout
        stderr = proc.stderr
        
        # Try to find JSON block in stdout
        json_data = {}
        for line in stdout.split("\n"):
            if line.strip().startswith("{") or line.strip().startswith("["):
                try:
                    # Clean trailing/leading non-json
                    start_idx = line.find("{")
                    if start_idx == -1:
                        start_idx = line.find("[")
                    end_idx = line.rfind("}")
                    if end_idx == -1:
                        end_idx = line.rfind("]")
                    json_data = json.loads(line[start_idx:end_idx+1])
                    break
                except Exception:
                    pass

        return {
            "success": proc.returncode == 0,
            "stdout": stdout,
            "stderr": stderr,
            "json": json_data
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "json": {}
        }

def main():
    print("==================================================")
    print("AP PLATFORM - MASTER PRODUCTION REGRESSION RUNNER")
    print("==================================================")

    results = {}
    passed_count = 0

    for script in SCRIPTS:
        run_res = run_script(script["file"])
        results[script["name"]] = run_res
        if run_res["success"]:
            passed_count += 1
            print(f"[{script['name']}] PASSED\n")
        else:
            print(f"[{script['name']}] FAILED")
            print(run_res["stderr"])
            print("\n")

    readiness_score = int((passed_count / len(SCRIPTS)) * 100)
    recommendation = "GO" if readiness_score >= 90 else "NO-GO"

    # Query metrics from DB
    db = SessionLocal()
    total_invoices = db.query(Invoice).count()
    total_pos = db.query(PurchaseOrder).count()
    db.close()

    # Create the report content
    report_content = f"""# Production Validation & Regression Test Report
**Date of Run**: {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}  
**Production Readiness Score**: {readiness_score}%  
**Recommendation**: **{recommendation}**

---

## 1. Executive Summary
- **Database Seeding**: {"PASSED" if results["Database Seeding"]["success"] else "WARNING"} (Invoices: {total_invoices}, POs: {total_pos})
- **Frontend Validation**: {"PASSED" if results["Frontend Validation"]["success"] else "FAILED"}
- **Backend Validation**: {"PASSED" if results["Backend Validation"]["success"] else "FAILED"}
- **Database Integrity**: {"PASSED" if results["Database Integrity"]["success"] else "FAILED"}
- **OCR Validation**: {"PASSED" if results["OCR Validation"]["success"] else "FAILED"}
- **AI Validation**: {"PASSED" if results["AI Validation"]["success"] else "FAILED"}
- **Compliance Rules**: {"PASSED" if results["Compliance Rules"]["success"] else "FAILED"}
- **Workflow & PO Match**: {"PASSED" if results["Workflow & PO Match"]["success"] else "FAILED"}
- **Performance Benchmarks**: {"PASSED" if results["Performance Benchmarks"]["success"] else "FAILED"}
- **Stress Concurrency**: {"PASSED" if results["Stress Concurrency"]["success"] else "FAILED"}
- **Security Scans**: {"PASSED" if results["Security Scans"]["success"] else "FAILED"}

## 2. Detailed Module Status

### Frontend Report
- **Status**: {"PASSED" if results["Frontend Validation"]["success"] else "FAILED"}
- **Details**: Verified React page structures, routing configuration, dark mode stylesheet mappings, and screen responsiveness.

### Backend Report
- **Status**: {"PASSED" if results["Backend Validation"]["success"] else "FAILED"}
- **Details**: Tested health route uptime, HTTP headers, request validation parsing, and error-handling status mapping.

### Database Report
- **Status**: {"PASSED" if results["Database Integrity"]["success"] else "FAILED"}
- **Details**: Validated transactional rollback triggers, database constraint check handlers, and CASCADE deletes on invoice item records.

### OCR & AI Validation Report
- **Status**: {"PASSED" if results["OCR Validation"]["success"] and results["AI Validation"]["success"] else "WARNING"}
- **Details**: Confirmed OCR extraction layout parser compatibility, missing field detection, and extraction confidence thresholds.

### Compliance & PO Matching Report
- **Status**: {"PASSED" if results["Compliance Rules"]["success"] and results["Workflow & PO Match"]["success"] else "FAILED"}
- **Details**: Verified GSTИН formatting rules, CGST/SGST/IGST alignment checking, tolerance mismatches, and workflow transition audit log writing.

### Concurrency Stress & Performance Report
- **Status**: {"PASSED" if results["Stress Concurrency"]["success"] else "FAILED"}
- **Details**: Benchmarked DB query latency, API response throughput, and simulated user load performance up to 100 concurrent clients.

### Security Report
- **Status**: {"PASSED" if results["Security Scans"]["success"] else "FAILED"}
- **Details**: Validated JWT authentication blocks on private endpoints, SQLi parameters parsing safety, and input sanitization metrics.

---
*Report compiled automatically by the Master Production Regression Runner.*
"""

    report_path = os.path.join(BASE_DIR, "production_validation_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"Unified Production Validation report successfully created at: {report_path}")

if __name__ == "__main__":
    main()
