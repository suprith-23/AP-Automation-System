import os
import time
import logging
from typing import Dict, Any
from fastapi import HTTPException

from app.ai.ocr.manager import OCRManager

# Configure Logger
logger = logging.getLogger("ap_automation.ocr_service")
logging.basicConfig(level=logging.INFO)

# Global Manager Instance
_manager = None

def get_ocr_manager() -> OCRManager:
    global _manager
    if _manager is None:
        _manager = OCRManager()
    return _manager

def extract_text_from_file_pipeline(file_bytes: bytes, filename: str) -> dict:
    """
    OCR pipeline routing entrypoint:
    - Delegates to OCRManager for routing and robust processing
    """
    start_time = time.perf_counter()
    manager = get_ocr_manager()
    
    try:
        ocr_result, source_type = manager.process_document(file_bytes, filename)
        
        # Log structured metrics (Phase 9 requirement)
        total_time = time.perf_counter() - start_time
        logger.info(
            "OCR Processing Completed",
            extra={
                "metrics": {
                    "provider": ocr_result.provider,
                    "pages": ocr_result.page_count,
                    "processing_time": ocr_result.processing_time,
                    "total_pipeline_time": total_time,
                    "confidence": ocr_result.confidence,
                    "status": "success",
                    "filename": filename
                }
            }
        )
        
        # We still return raw_text and source_type for backwards compatibility with the existing extraction pipeline,
        # but the heavy lifting and standardization is done in the providers.
        # We can also start returning the full structured data.
        return {
            "raw_text": ocr_result.text,
            "source_type": source_type,
            "ocr_result": ocr_result,
            "metadata": {
                "provider": ocr_result.provider,
                "confidence": ocr_result.confidence,
                "pages": ocr_result.page_count,
                "processing_time": ocr_result.processing_time
            }
        }
    except Exception as e:
        logger.error(
            "OCR Processing Failed",
            extra={
                "metrics": {
                    "status": "failed",
                    "errors": str(e),
                    "filename": filename
                }
            }
        )
        raise e
