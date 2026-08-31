"""Transition handler routing stage execution and logic verification of modules."""
import logging
import time
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.workflow.exceptions import WorkflowException

logger = logging.getLogger("workflow.transitions")

class TransitionRunner:
    @staticmethod
    def execute_ocr(db: Session, invoice_id: int, file_bytes: bytes, filename: str, ocr_res: dict) -> dict:
        """Saves raw text/blocks on the invoice."""
        t0 = time.perf_counter()
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        invoice.raw_ocr_text = ocr_res["raw_text"]
        invoice.source_type = ocr_res["source_type"]
        db.commit()

        duration = time.perf_counter() - t0
        return {
            "success": True,
            "duration_sec": duration,
            "ocr_result": ocr_res["ocr_result"]
        }

    @staticmethod
    async def execute_ai_extraction(db: Session, invoice_id: int, ocr_result: list, prompt_version: str = None, extraction_res: dict = None) -> dict:
        """Executes AI semantic extraction to create normalized schema fields."""
        from app.validation.service import ValidationService
        t0 = time.perf_counter()
        
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        if extraction_res is None:
            # Fallback if called directly without decoupled extraction
            from app.ai.extraction.pipeline import ExtractionPipeline
            tenant_id = str(invoice.organization_id) if invoice.organization_id else "global"
            extraction_res = await ExtractionPipeline.process(ocr_result, prompt_version=prompt_version, tenant_id=tenant_id)

        invoice_data = extraction_res.get("invoice_data", {})
        confidence_data = extraction_res.get("confidence", {})
        prompt_version_used = extraction_res.get("prompt_version", "unknown")

        # Enforce missing-confidence = 0.0 (UNKNOWN)
        for k in invoice_data.keys():
            if k != "items" and k not in confidence_data:
                confidence_data[k] = 0.0

        # Calculate average confidence
        conf_scores = [v for v in confidence_data.values() if isinstance(v, (int, float))]
        avg_confidence = sum(conf_scores) / len(conf_scores) if conf_scores else 0.0

        # Run nested transaction (savepoint) for rollback safety
        try:
            with db.begin_nested():
                # Map fields to invoice columns
                for k, v in invoice_data.items():
                    if k != "items" and hasattr(invoice, k):
                        if k == "invoice_date" and isinstance(v, str):
                            try:
                                v = datetime.strptime(v, "%Y-%m-%d").date()
                            except ValueError:
                                pass
                        setattr(invoice, k, v)

                # Retain backward compatibility fields
                invoice.vendor_name = invoice_data.get("seller_name")
                invoice.due_date = datetime.strptime(invoice_data.get("due_date"), "%Y-%m-%d").date() if invoice_data.get("due_date") else None
                invoice.subtotal = invoice_data.get("total_taxable_value")
                invoice.tax_amount = invoice_data.get("total_cgst_value", 0.0) + invoice_data.get("total_sgst_value", 0.0) + invoice_data.get("total_igst_value", 0.0)
                invoice.total_amount = invoice_data.get("total_invoice_value")

                # Persist extracted line items
                from app.models.invoice_item import InvoiceItem
                
                # Clear existing items if this is a retry/re-extraction
                for item in list(invoice.items):
                    db.delete(item)
                    
                extracted_items = invoice_data.get("items", [])
                for item_data in extracted_items:
                    db_item = InvoiceItem(
                        invoice_id=invoice.id,
                        item_number=item_data.get("item_number") or item_data.get("sl_no"),
                        description=item_data.get("description"),
                        hsn_code=item_data.get("hsn_code"),
                        quantity=item_data.get("quantity", 0.0),
                        unit_price=item_data.get("unit_price", 0.0),
                        total_amount=item_data.get("total_amount", 0.0),
                        igst_amount=item_data.get("igst_amount", 0.0),
                        cgst_amount=item_data.get("cgst_amount", 0.0),
                        sgst_amount=item_data.get("sgst_amount", 0.0),
                        gst_rate=item_data.get("gst_rate", 0.0),
                        total_item_value=item_data.get("total_item_value", 0.0)
                    )
                    db.add(db_item)

                invoice.extracted_json = {**invoice_data, "prompt_version_used": prompt_version_used}
                invoice.confidence_json = confidence_data
                invoice.confidence_score = avg_confidence
                invoice.extraction_timestamp = datetime.utcnow()

                # Deterministic validation before authoritative persistence / final commit
                invoice_payload = invoice_data.copy()
                invoice_payload["id"] = invoice.id
                invoice_payload["seller_gstin"] = invoice_data.get("seller_gstin")
                invoice_payload["seller_name"] = invoice_data.get("seller_name")
                invoice_payload["total_invoice_value"] = invoice_data.get("total_invoice_value")
                invoice_payload["confidence_score"] = avg_confidence
                invoice_payload["confidence"] = confidence_data

                val_service = ValidationService()
                val_report = val_service.validate(invoice_payload, db=db)
                
                invoice.validation_status = val_report["overall_status"]
                flat_errors = []
                for field, errs in val_report.get("field_errors", {}).items():
                    for err in errs:
                        flat_errors.append(f"{field}: {err}")
                invoice.validation_errors = flat_errors

            # Commit the transaction block safely
            db.commit()
        except Exception as db_err:
            logger.error(f"Failed to persist and validate extraction data: {db_err}")
            raise db_err

        duration = time.perf_counter() - t0
        return {
            "success": True,
            "duration_sec": duration,
            "prompt_version_used": prompt_version_used,
            "avg_confidence": avg_confidence,
            "invoice_data": invoice_data
        }

    @staticmethod
    def execute_validation(db: Session, invoice_id: int) -> dict:
        """Executes base field validation rules on invoice."""
        from app.validation.service import ValidationService
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        # Re-construct validation payload
        invoice_payload = invoice.extracted_json.copy() if invoice.extracted_json else {}
        invoice_payload["id"] = invoice.id

        val_service = ValidationService()
        val_report = val_service.validate(invoice_payload, db=db)
        
        invoice.validation_status = val_report["overall_status"]
        flat_errors = []
        for field, errs in val_report.get("field_errors", {}).items():
            for err in errs:
                flat_errors.append(f"{field}: {err}")
        invoice.validation_errors = flat_errors
        db.commit()

        return {
            "success": True,
            "status": val_report["overall_status"],
            "errors": flat_errors
        }

    @staticmethod
    def execute_gst_verification(db: Session, invoice_id: int) -> dict:
        """Runs GST compliance and reconciliation verification."""
        from app.services.gst_compliance import GSTComplianceEngine
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        engine = GSTComplianceEngine()
        gst_report = engine.verify_gst_compliance(db, invoice)
        
        return {
            "success": gst_report["is_compliant"],
            "errors": gst_report["errors"],
            "warnings": gst_report["warnings"],
            "report": gst_report
        }

    @staticmethod
    def execute_tds_calculation(db: Session, invoice_id: int) -> dict:
        """Performs TDS calculation logic and registers ledger entries."""
        from app.services.tds_engine import TDSEngine
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        engine = TDSEngine()
        tds_report = engine.calculate_tds(db, invoice)

        return {
            "success": tds_report["status"] in ["PASS", "WARNING"],
            "status": tds_report["status"],
            "tds_amount": tds_report["tds_amount"],
            "applicable_section": tds_report["applicable_section"],
            "report": tds_report
        }

    @staticmethod
    def execute_po_matching(db: Session, invoice_id: int) -> dict:
        """Evaluates purchase order matching results."""
        from app.matching.service import POMatchingService
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        service = POMatchingService()
        match_report = service.match_and_persist(db, invoice_id)

        return {
            "success": invoice.match_status == "MATCHED",
            "status": invoice.match_status,
            "score": invoice.match_score,
            "report": match_report
        }

    @staticmethod
    def execute_erp_sync(db: Session, invoice_id: int) -> dict:
        """Simulates sync of the invoice to the external ERP system."""
        # ERP sync simulation
        logger.warning(f"ERP sync requested for invoice {invoice_id}. Using mock ERP sync.")
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        invoice.processed_at = datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "erp_reference": f"MOCK-ERP-SYNC-{invoice_id}-{int(time.time())}"
        }

    @staticmethod
    def execute_payment_scheduling(db: Session, invoice_id: int) -> dict:
        """Initializes payment schedules for approved and synced invoices."""
        from app.services.payment_manager import PaymentManager
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise WorkflowException(f"Invoice {invoice_id} not found.")

        manager = PaymentManager()
        schedule = manager.initialize_payment_schedule(db, invoice)

        return {
            "success": True,
            "outstanding_balance": schedule.outstanding_balance,
            "due_date": schedule.due_date.isoformat()
        }
