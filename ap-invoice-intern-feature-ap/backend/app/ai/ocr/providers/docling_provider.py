import time
import os
import tempfile
import logging
from typing import Union
from threading import Lock
import numpy as np

from app.ai.ocr.providers.base import OCRProvider
from app.ai.ocr.models import OCRResult, OCRBlock
from app.ai.docling_engine import DoclingEngine
from app.utils.memory_utils import get_process_memory_mb

logger = logging.getLogger("ap_automation.docling_provider")

class DoclingProvider(OCRProvider):
    _instance = None
    _lock = Lock()

    def __init__(self):
        logger.info("[OCR_PROVIDER_LOAD] provider=Docling")
        self.warm_up()

    @classmethod
    def get_instance(cls) -> "DoclingProvider":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @property
    def provider_name(self) -> str:
        return "Docling"

    def warm_up(self) -> None:
        if not hasattr(self, "engine"):
            logger.info("Initializing Docling engine via singleton registry...")
            t0 = time.perf_counter()
            mem_before = get_process_memory_mb()
            
            self.engine = DoclingEngine.get_instance()
            
            mem_after = get_process_memory_mb()
            startup_time = time.perf_counter() - t0
            logger.info(f"[OCR] Docling startup: {startup_time:.2f}s")
            logger.info(f"[OCR] Memory before: {mem_before:.0f} MB")
            logger.info(f"[OCR] Memory after: {mem_after:.0f} MB")
            logger.info(f"[OCR] Delta: +{mem_after - mem_before:.0f} MB")

    def extract_text_from_image(self, image: Union[bytes, np.ndarray]) -> OCRResult:
        """Docling is primarily for documents, so image extraction is minimally supported or raises."""
        raise NotImplementedError("DoclingProvider does not currently support raw image array extraction natively. Use RapidOCR.")

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> OCRResult:
        start_time = time.perf_counter()
        temp_pdf_path = None
        
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_pdf:
                temp_pdf.write(pdf_bytes)
                temp_pdf_path = temp_pdf.name

            result = self.engine.convert(temp_pdf_path)
            markdown_text = result.document.export_to_markdown()
            
            if not markdown_text or not markdown_text.strip():
                raise ValueError("Docling returned empty text.")

            # Docling doesn't natively return word-level bounding boxes easily in the standard markdown output
            # We return empty blocks and high confidence if markdown is parsed successfully
            processing_time = time.perf_counter() - start_time
            
            # Approximate page count (usually 1+ depending on doc format)
            page_count = 1 
            if hasattr(result.document, "pages"):
                page_count = len(result.document.pages)

            # Calculate a realistic baseline confidence based on text cleanliness (ratio of alphanumeric + standard punctuation to total chars)
            text_len = len(markdown_text)
            if text_len > 0:
                clean_chars = sum(1 for c in markdown_text if c.isalnum() or c.isspace() or c in ".,-₹$%()[]{}#@!&*_+=\\/:;\"'")
                clean_ratio = clean_chars / text_len
                docling_conf = round(max(0.1, min(1.0, clean_ratio)), 2)
            else:
                docling_conf = 0.0

            return OCRResult(
                text=markdown_text.strip(),
                blocks=[],  # Docling primarily returns text structure, not distinct BBs in this mode
                confidence=docling_conf,
                provider=self.provider_name,
                processing_time=processing_time,
                page_count=page_count
            )
        except Exception as e:
            logger.error(f"Docling PDF extraction failed: {str(e)}")
            raise e
        finally:
            if temp_pdf_path and os.path.exists(temp_pdf_path):
                try:
                    os.remove(temp_pdf_path)
                except Exception as ex:
                    logger.warning(f"Failed to delete temp PDF file {temp_pdf_path}: {ex}")
