import os
import time
import logging
from datetime import datetime
from typing import Dict, Any
import anyio
from fastapi import HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Dict, Any, Optional

from app.ai.services.ocr_service import extract_text_from_file_pipeline
from app.ai.extraction.pipeline import ExtractionPipeline
from app.services.invoice_service import create_invoice
from app.services.audit_log_service import create_audit_log
from app.schemas.invoice import InvoiceCreate

logger = logging.getLogger("ap_automation.ingestion_orchestrator")

class IngestionOrchestrator:
    """Orchestrates file format verification, OCR timing, LLM extraction, validation, and database ingestion."""
    
    @staticmethod
    def validate_file_size_and_type(file_bytes: bytes, filename: str, allowed_extensions=(".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
        """
        Purpose:
            Verify the uploaded file size and extension/magic-bytes format against allowed limits.
        Inputs:
            - file_bytes (bytes): The raw binary content of the file.
            - filename (str): The name of the file.
            - allowed_extensions (tuple): Allowed file extension strings.
        Outputs:
            - None: Raises HTTPException if validation fails.
        """
        MAX_FILE_SIZE = 10 * 1024 * 1024
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds the maximum limit of {MAX_FILE_SIZE // (1024 * 1024)}MB."
            )
        
        ext = os.path.splitext(filename)[1].lower()
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Please upload one of: {', '.join(allowed_extensions)}"
            )

        # Validate magic bytes
        if ext == ".pdf":
            if not file_bytes.startswith(b"%PDF"):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid PDF file signature."
                )
        else:
            is_valid_image = (
                file_bytes.startswith(b"\x89PNG\r\n\x1a\n") or  # PNG
                file_bytes.startswith(b"\xff\xd8\xff") or       # JPEG
                file_bytes.startswith(b"II*\x00") or            # TIFF (little-endian)
                file_bytes.startswith(b"MM\x00*") or            # TIFF (big-endian)
                file_bytes.startswith(b"BM")                    # BMP
            )
            if not is_valid_image:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Image file signature."
                )

    @classmethod
    async def process_raw_extraction(cls, file_bytes: bytes, filename: str) -> dict:
        """
        Purpose:
            Perform raw OCR and LLM schema extraction on a file without saving it to the database.
        Inputs:
            - file_bytes (bytes): Raw binary content of the file.
            - filename (str): Name of the file.
        Outputs:
            - dict: Extracted JSON data dictionary.
        """
        total_start = time.perf_counter()
        cls.validate_file_size_and_type(file_bytes, filename)
        
        # 1. OCR Phase
        ocr_start = time.perf_counter()
        ocr_res = await anyio.to_thread.run_sync(
            extract_text_from_file_pipeline, file_bytes, filename
        )
        ocr_text = ocr_res["raw_text"]
        ocr_result = ocr_res["ocr_result"]
        ocr_time = time.perf_counter() - ocr_start

        if not ocr_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not extract any readable text from the file."
            )

        # 2. LLM Extraction Phase
        llm_start = time.perf_counter()
        result = await ExtractionPipeline.process(ocr_result)
        llm_time = time.perf_counter() - llm_start

        # Sanitize metadata fields
        cls._sanitize_extraction_data(result)

        total_time = time.perf_counter() - total_start
        logger.info(
            f"=== INVOICE EXTRACTION PERFORMANCE METRICS ===\n"
            f"File Processed: {filename}\n"
            f"OCR / Text Extraction Time: {ocr_time:.3f}s\n"
            f"LLM Schema Extraction Time: {llm_time:.3f}s\n"
            f"Total Ingestion Processing Time: {total_time:.3f}s\n"
            f"=============================================="
        )
        return result

    @classmethod
    async def process_and_persist_invoice(cls, db: Session, file_bytes: bytes, filename: str, organization_id: Optional[UUID] = None) -> dict:
        """
        Purpose:
            Perform OCR, LLM extraction, sanitization, validation, database persistence,
            and log auditing for an uploaded invoice file.
        Inputs:
            - db (Session): Active database session.
            - file_bytes (bytes): Raw binary content of the file.
            - filename (str): Name of the file.
        Outputs:
            - dict: Result dict containing:
                - invoice_data: Sanitized dictionary of extracted fields.
                - validation_result: Validation status and errors.
                - confidence: Field confidence mapping.
                - invoice: Created database Invoice model instance.
        """
        upload_timestamp = datetime.utcnow()
        total_start = time.perf_counter()
        cls.validate_file_size_and_type(file_bytes, filename, allowed_extensions=(".pdf", ".png", ".jpg", ".jpeg"))

        ocr_duration_ms = 0.0
        llm_duration_ms = 0.0

        try:
            # 1. OCR Phase
            ocr_start = time.perf_counter()
            ocr_res = await anyio.to_thread.run_sync(
                extract_text_from_file_pipeline, file_bytes, filename
            )
            ocr_duration_ms = (time.perf_counter() - ocr_start) * 1000

            raw_text = ocr_res["raw_text"]
            source_type = ocr_res["source_type"]
            ocr_result = ocr_res["ocr_result"]

            if not raw_text.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract any readable text from the file."
                )

            # 2. Pipeline Extraction Phase (Cleaning, Layout, LLM, Validation)
            llm_start = time.perf_counter()
            llm_res = await ExtractionPipeline.process(ocr_result)
            llm_duration_ms = (time.perf_counter() - llm_start) * 1000

            invoice_data = llm_res.get("invoice_data", {})
            confidence_data = llm_res.get("confidence", {})

            # Handle flat or nested structure from LLM response
            if not invoice_data:
                invoice_data = {k: v for k, v in llm_res.items() if k != "confidence"}
                if not confidence_data:
                    confidence_data = {k: 0.9 for k in invoice_data.keys() if k != "items"}

            # Calculate average confidence score
            conf_scores = [v for v in confidence_data.values() if isinstance(v, (int, float))]
            avg_confidence = sum(conf_scores) / len(conf_scores) if conf_scores else 1.0

            # Sanitize metadata fields
            cls._sanitize_extraction_data(invoice_data)

            # Filter out None values to allow Pydantic defaults for non-optional fields
            cleaned_invoice_data = cls._clean_none_values(invoice_data)

            # Strip pipeline-internal keys that are not Invoice model columns
            _PIPELINE_INTERNAL_KEYS = {
                "confidence", "validation_errors", "extraction_metadata",
                "prompt_version", "debug_compressed_tokens",
                "ocr_duration_ms", "llm_duration_ms", "total_duration_ms"
            }
            cleaned_invoice_data = {
                k: v for k, v in cleaned_invoice_data.items()
                if k not in _PIPELINE_INTERNAL_KEYS
            }

            # Store durations inside extracted_json for SLA calculations
            total_duration_ms = (time.perf_counter() - total_start) * 1000
            invoice_data["ocr_duration_ms"] = ocr_duration_ms
            invoice_data["llm_duration_ms"] = llm_duration_ms
            invoice_data["total_duration_ms"] = total_duration_ms

            # 3. Create Document DB Record and Persist File
            from app.ingestion.storage import get_storage_provider
            from app.models.document import Document
            storage_provider = get_storage_provider()
            storage_path = storage_provider.save(file_bytes, filename)
            
            doc = Document(
                filename=filename,
                storage_path=storage_path,
                file_size=len(file_bytes),
                content_type="application/pdf" if filename.lower().endswith(".pdf") else "image/png",
                uploaded_at=datetime.utcnow(),
                status="processed"
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            # 4. Create Invoice DB Record
            invoice_create = InvoiceCreate(
                **cleaned_invoice_data,
                source_type=source_type,
                raw_ocr_text=raw_text,
                extracted_json=invoice_data,
                confidence_json=confidence_data,
                confidence_score=avg_confidence,
                extraction_timestamp=datetime.utcnow(),
                document_id=doc.id
            )

            db_invoice = await anyio.to_thread.run_sync(
                create_invoice, db, invoice_create, organization_id
            )

            # Log audit trail
            create_audit_log(
                db=db,
                action="OCR_EXTRACTION",
                invoice_id=db_invoice.id,
                status_before=None,
                status_after=db_invoice.workflow_status.value if hasattr(db_invoice.workflow_status, "value") else db_invoice.workflow_status,
                performed_by="system",
                details={
                    "upload_timestamp": upload_timestamp.isoformat(),
                    "ocr_duration_ms": ocr_duration_ms,
                    "llm_duration_ms": llm_duration_ms,
                    "total_duration_ms": total_duration_ms,
                    "extraction_status": "SUCCESS"
                }
            )

            return {
                "invoice_data": invoice_data,
                "validation_result": {
                    "passed": db_invoice.validation_status == "PASSED" and not llm_res.get("validation_errors"),
                    "errors": (db_invoice.validation_errors or []) + llm_res.get("validation_errors", [])
                },
                "confidence": confidence_data,
                "invoice": db_invoice
            }

        except Exception as e:
            total_duration_ms = (time.perf_counter() - total_start) * 1000
            logger.error(f"Invoice extraction pipeline failed: {str(e)}")
            db.rollback()
            create_audit_log(
                db=db,
                action="OCR_EXTRACTION",
                invoice_id=None,
                performed_by="system",
                details={
                    "upload_timestamp": upload_timestamp.isoformat(),
                    "ocr_duration_ms": ocr_duration_ms,
                    "llm_duration_ms": llm_duration_ms,
                    "total_duration_ms": total_duration_ms,
                    "extraction_status": "FAILED",
                    "error_detail": str(e)
                }
            )
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=500,
                detail=f"Invoice ingestion pipeline failed: {str(e)}"
            )

    @staticmethod
    def _correct_gstin_ocr_typos(gstin: str) -> str:
        """
        Purpose:
            Correct common OCR typos in GSTIN strings (e.g. O instead of 0, I instead of 1)
            according to the Indian GSTIN format specification.
        Inputs:
            - gstin (str): Raw extracted GSTIN string.
        Outputs:
            - str: Corrected GSTIN string.
        """
        if not gstin or len(gstin) != 15:
            return gstin
        num_to_let = {'0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '8': 'B'}
        let_to_num = {'O': '0', 'I': '1', 'Z': '2', 'A': '4', 'S': '5', 'B': '8', 'Q': '0'}
        
        # Format: 2 digits + 5 letters + 4 digits + 1 letter + 1 entity + 1 Z + 1 checksum
        part1 = gstin[:2]
        part2 = "".join([num_to_let.get(c, c) if c.isdigit() else c for c in gstin[2:7]])
        part3 = "".join([let_to_num.get(c, c) if c.isalpha() else c for c in gstin[7:11]])
        part4 = "".join([num_to_let.get(c, c) if c.isdigit() else c for c in gstin[11:12]])
        part5 = gstin[12:]
        return part1 + part2 + part3 + part4 + part5

    @classmethod
    def _normalize_date_string(cls, date_val: Any) -> Any:
        """
        Purpose:
            Parse and normalize various date string formats to standard YYYY-MM-DD format.
        Inputs:
            - date_val (Any): Input date representation (string, datetime, etc.).
        Outputs:
            - Any: Normalized YYYY-MM-DD string, or original value if parsing failed.
        """
        if not date_val:
            return None
        if not isinstance(date_val, str):
            if hasattr(date_val, "isoformat"):
                return date_val.isoformat()
            return date_val
            
        date_str = date_val.strip()
        if not date_str:
            return None
            
        import re
        from datetime import datetime
        
        # Clean up any surrounding brackets/quotes
        date_str = re.sub(r'^[\'"]|[\'"]$', '', date_str).strip()
        
        # Try standard YYYY-MM-DD first
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return date_str
        except ValueError:
            pass
            
        # Try DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY or MM-DD-YYYY or YYYY/MM/DD
        delimiters = ['/', '-', '.']
        for delim in delimiters:
            parts = date_str.split(delim)
            if len(parts) == 3:
                # Pad single digits
                parts = [p.zfill(2) for p in parts]
                if len(parts[0]) == 4: # YYYY/MM/DD
                    try:
                        dt = datetime.strptime(f"{parts[0]}-{parts[1]}-{parts[2]}", "%Y-%m-%d")
                        return dt.date().isoformat()
                    except ValueError:
                        pass
                elif len(parts[2]) == 4: # DD-MM-YYYY or MM-DD-YYYY
                    # Standard assumption: DD/MM/YYYY (common in Indian invoices)
                    try:
                        dt = datetime.strptime(f"{parts[0]}-{parts[1]}-{parts[2]}", "%d-%m-%Y")
                        return dt.date().isoformat()
                    except ValueError:
                        # Fallback MM-DD-YYYY
                        try:
                            dt = datetime.strptime(f"{parts[0]}-{parts[1]}-{parts[2]}", "%m-%d-%Y")
                            return dt.date().isoformat()
                        except ValueError:
                            pass
                elif len(parts[2]) == 2: # DD-MM-YY or MM-DD-YY
                    try:
                        dt = datetime.strptime(f"{parts[0]}-{parts[1]}-{parts[2]}", "%d-%m-%y")
                        return dt.date().isoformat()
                    except ValueError:
                        try:
                            dt = datetime.strptime(f"{parts[0]}-{parts[1]}-{parts[2]}", "%m-%d-%y")
                            return dt.date().isoformat()
                        except ValueError:
                            pass
        
        # Try text-based formats
        formats = [
            "%d %b %Y", "%d-%b-%Y", "%d %B %Y", "%B %d, %Y", "%b %d, %Y",
            "%d %b %y", "%d-%b-%y", "%d %B %y",
            "%Y/%m/%d", "%y-%m-%d"
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.date().isoformat()
            except ValueError:
                continue
                
        return date_str

    @classmethod
    def _sanitize_extraction_data(cls, data: Any):
        """
        Purpose:
            Correct OCR typos in GSTINs, normalize dates, and infer/fallback missing
            total and taxable values at item and header levels.
        Inputs:
            - data (Any): Extracted dictionary to mutate in-place.
        Outputs:
            - None: Mutates the dictionary in-place.
        """
        if isinstance(data, dict):
            data_to_sanitize = data.get("invoice_data") if "invoice_data" in data else data
            
            for field in ["seller_gstin", "buyer_gstin", "shipping_gstin"]:
                if field in data_to_sanitize and data_to_sanitize[field]:
                    data_to_sanitize[field] = cls._correct_gstin_ocr_typos(str(data_to_sanitize[field]))
                    
            for field in ["invoice_number", "po_number", "irn"]:
                if field in data_to_sanitize and data_to_sanitize[field] is not None:
                    val = str(data_to_sanitize[field]).strip()
                    while val and (val.startswith(":") or val.startswith("-") or val.startswith(" ")):
                        val = val[1:].strip()
                    # Also replace internal spaces around dashes for standard formatting
                    val = val.replace(" - ", "-")
                    data_to_sanitize[field] = val

            for field in ["invoice_date", "due_date"]:
                if field in data_to_sanitize and data_to_sanitize[field]:
                    data_to_sanitize[field] = cls._normalize_date_string(data_to_sanitize[field])
                    data_to_sanitize[field] = str(data_to_sanitize[field])

            header_float_fields = [
                "total_taxable_value", "total_gst_rate", "total_cgst_value", "total_sgst_value", 
                "total_igst_value", "total_ces_value", "total_st_ces_value", "total_discount_value", 
                "round_off_amount", "total_accessment_value", "total_invoice_value",
                "seller_gstin_pincode", "buyer_gstin_pincode", "shipping_gstin_pincode"
            ]
            for f in header_float_fields:
                if f in data_to_sanitize and data_to_sanitize[f] is not None:
                    try:
                        if "pincode" in f:
                            data_to_sanitize[f] = int(float(str(data_to_sanitize[f]).strip()))
                        else:
                            clean_val = str(data_to_sanitize[f]).replace("₹", "").replace(",", "").strip()
                            data_to_sanitize[f] = float(clean_val)
                    except (ValueError, TypeError):
                        data_to_sanitize[f] = None

            if "items" in data_to_sanitize and isinstance(data_to_sanitize["items"], list):
                # Summary/footer keywords that the LLM sometimes emits as line items
                _SUMMARY_KEYWORDS = {
                    "subtotal", "total", "grand total", "net total", "amount due",
                    "balance due", "tax total", "gst total", "igst total", "cgst total",
                    "sgst total", "total amount", "invoice total", "total payable",
                    "net payable", "round off", "discount", "freight", "shipping",
                    "total tax", "total due",
                }

                def _is_summary_row(item: dict) -> bool:
                    """Return True if this row looks like a summary/footer row, not a product line."""
                    item_no_raw = item.get("item_number")
                    desc_raw = item.get("description", "") or ""
                    
                    # If item contains a valid quantity and unit_price, it's a legitimate line item, not a summary row!
                    qty = item.get("quantity")
                    price = item.get("unit_price")
                    if qty is not None and price is not None:
                        try:
                            if float(str(qty).replace("₹", "").replace(",", "").strip()) > 0 and float(str(price).replace("₹", "").replace(",", "").strip()) > 0:
                                return False
                        except (ValueError, TypeError):
                            pass

                    # If item_number is a string that cannot be cast to a number
                    if item_no_raw is not None:
                        try:
                            int(float(str(item_no_raw).strip()))
                        except (ValueError, TypeError):
                            # item_number is a word – summary row if description is empty or also matches summary keywords
                            if str(item_no_raw).strip().lower() in _SUMMARY_KEYWORDS:
                                if not desc_raw.strip() or desc_raw.strip().lower() in _SUMMARY_KEYWORDS:
                                    return True
                            # If item_number is non-numeric AND description is empty or also a keyword
                            if not desc_raw.strip() or desc_raw.strip().lower() in _SUMMARY_KEYWORDS:
                                return True
                    # If item_number is missing/None but description matches a summary keyword
                    if item_no_raw is None and desc_raw.strip().lower() in _SUMMARY_KEYWORDS:
                        return True
                    return False

                # Filter out summary/footer rows before further processing
                data_to_sanitize["items"] = [
                    item for item in data_to_sanitize["items"]
                    if not _is_summary_row(item)
                ]

                calc_taxable = 0.0
                calc_cgst = 0.0
                calc_sgst = 0.0
                calc_igst = 0.0
                calc_cess = 0.0
                calc_total = 0.0

                for item in data_to_sanitize["items"]:
                    if "item_number" in item and item["item_number"] is not None:
                        try:
                            item["item_number"] = int(float(str(item["item_number"]).strip()))
                        except (ValueError, TypeError):
                            # Coerce to None so Pydantic's Optional[int] accepts it
                            item["item_number"] = None

                    float_fields = [
                        "quantity", "unit_price", "total_amount", "discount", "assessable_value", 
                        "gst_rate", "igst_amount", "cgst_amount", "sgst_amount", "cess_rate", 
                        "cess_amount", "cess_non_advalorem_amount", "state_cess_rate", 
                        "state_cess_amount", "other_charges", "total_item_value"
                    ]
                    for f in float_fields:
                        if f in item and item[f] is not None:
                            try:
                                clean_val = str(item[f]).replace("₹", "").replace(",", "").strip()
                                item[f] = float(clean_val)
                            except (ValueError, TypeError):
                                item[f] = None

                    if "sl_no" in item and item["sl_no"] is not None:
                        item["sl_no"] = str(item["sl_no"])
                    if "hsn_code" in item and item["hsn_code"] is not None:
                        item["hsn_code"] = str(item["hsn_code"])
                    # Enforce is_service based on HSN prefix starting with "99" (Service Accounting Code)
                    hsn = item.get("hsn_code")
                    is_srv = item.get("is_service")
                    if hsn and str(hsn).strip().startswith("99"):
                        item["is_service"] = "Y"
                    elif is_srv is True or (isinstance(is_srv, str) and is_srv.lower() in ("true", "y")):
                        item["is_service"] = "Y"
                    else:
                        item["is_service"] = "N"

                    # Accumulate for fallback header totals
                    calc_taxable += float(item.get("assessable_value") or item.get("total_amount") or 0.0)
                    calc_cgst += float(item.get("cgst_amount") or 0.0)
                    calc_sgst += float(item.get("sgst_amount") or 0.0)
                    calc_igst += float(item.get("igst_amount") or 0.0)
                    calc_cess += float(item.get("cess_amount") or 0.0)
                    calc_total += float(item.get("total_item_value") or 0.0)

                # Fallback inferences if header values are missing
                if data_to_sanitize.get("total_taxable_value") is None:
                    data_to_sanitize["total_taxable_value"] = calc_taxable
                
                if data_to_sanitize.get("total_cgst_value") is None:
                    data_to_sanitize["total_cgst_value"] = calc_cgst
                    
                if data_to_sanitize.get("total_sgst_value") is None:
                    data_to_sanitize["total_sgst_value"] = calc_sgst
                    
                if data_to_sanitize.get("total_igst_value") is None:
                    data_to_sanitize["total_igst_value"] = calc_igst

                if data_to_sanitize.get("total_ces_value") is None:
                    data_to_sanitize["total_ces_value"] = calc_cess
                    
                if data_to_sanitize.get("total_invoice_value") is None:
                    # If item totals don't equal taxable + tax, fallback to the manual calculation
                    fallback_total = calc_taxable + calc_cgst + calc_sgst + calc_igst + calc_cess
                    data_to_sanitize["total_invoice_value"] = calc_total if calc_total > 0 else fallback_total

    @classmethod
    def _clean_none_values(cls, data: Any) -> Any:
        """
        Purpose:
            Filter out None/null values from the dictionary structure recursively.
        Inputs:
            - data (Any): Dictionary, list, or primitive value.
        Outputs:
            - Any: Structure with None fields removed.
        """
        if isinstance(data, dict):
            return {k: cls._clean_none_values(v) for k, v in data.items() if v is not None}
        elif isinstance(data, list):
            return [cls._clean_none_values(item) for item in data]
        return data
