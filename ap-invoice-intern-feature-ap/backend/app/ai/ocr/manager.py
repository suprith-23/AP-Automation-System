import logging
import os
import io
import time
import numpy as np
from typing import Union, Tuple
from fastapi import HTTPException
from pypdf import PdfReader
from PIL import Image

from app.ai.ocr.providers.rapidocr_provider import RapidOCRProvider
from app.ai.ocr.providers.docling_provider import DoclingProvider
from app.ai.ocr.models import OCRResult, OCRBlock

logger = logging.getLogger("ap_automation.ocr_manager")

class OCRManager:
    """
    Orchestrates OCR extraction, routing to the correct provider and handling fallbacks/retries.
    """
    
    def __init__(self):
        from app.core.config import CONFIG
        self.size_threshold_mb = float(CONFIG.validation_rules.get("size_threshold_mb", 2.0))

    @property
    def rapid_ocr(self):
        return RapidOCRProvider.get_instance()

    @property
    def docling(self):
        return DoclingProvider.get_instance()
        
    def _execute_with_retry(self, provider, method_name: str, payload: Union[bytes, str], max_retries: int = 2) -> OCRResult:
        """Executes an OCR provider method with a basic retry loop to handle transient faults."""
        last_exception = None
        for attempt in range(1, max_retries + 1):
            try:
                method = getattr(provider, method_name)
                result = method(payload)
                if not result.text.strip():
                    raise ValueError(f"{provider.provider_name} returned empty text.")
                return result
            except Exception as e:
                last_exception = e
                logger.warning(f"Attempt {attempt} failed for {provider.provider_name}.{method_name}: {e}")
                
        logger.error(f"All {max_retries} attempts failed for {provider.provider_name}.")
        raise last_exception or Exception(f"{provider.provider_name} failed unexpectedly.")

    def process_document(self, file_bytes: bytes, filename: str) -> Tuple[OCRResult, str]:
        """
        Process a document (PDF or Image) with robust routing and fallbacks.
        Returns:
            Tuple[OCRResult, str]: The extracted result and the source_type
        """
        ext = os.path.splitext(filename)[1].lower()
        source_type = "pdf_upload" if ext == ".pdf" else "image_upload"
        # Enforce validation checks on payload
        # 1. Reject if empty file bytes
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty document payload uploaded.")

        # 2. File size limit
        file_size_mb = len(file_bytes) / (1024 * 1024)
        if file_size_mb > 10.0:
            raise HTTPException(status_code=400, detail="File size exceeds maximum permitted threshold of 10MB.")

        # 3. Magic-byte signature verification
        # PDF signatures start with %PDF (\x25\x50\x44\x46)
        # PNG signatures start with \x89PNG (\x89\x50\x4E\x47)
        # JPEG signatures start with \xFF\xD8\xFF
        is_pdf_sig = file_bytes.startswith(b"%PDF")
        is_png_sig = file_bytes.startswith(b"\x89PNG")
        is_jpg_sig = file_bytes.startswith(b"\xff\xd8\xff")

        if ext == ".pdf" and not is_pdf_sig:
            raise HTTPException(status_code=400, detail="Invalid PDF signature magic-bytes.")
        if ext in (".png", ".jpg", ".jpeg"):
            if not (is_png_sig or is_jpg_sig):
                raise HTTPException(status_code=400, detail="Invalid Image signature magic-bytes.")
            try:
                img = Image.open(io.BytesIO(file_bytes))
                img.verify()
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid or corrupt image file payload.")
        if not (is_pdf_sig or is_png_sig or is_jpg_sig):
            raise HTTPException(status_code=415, detail="Unsupported document type signature.")

        if source_type == "pdf_upload":
            start_time = time.perf_counter()
            try:
                reader = PdfReader(io.BytesIO(file_bytes))
                page_count = len(reader.pages)
                
                # Check for digital text
                extracted_text = ""
                blocks = []
                for page_num, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if text:
                        extracted_text += text + "\n"
                        # Generate synthetic line-level blocks
                        lines = text.split("\n")
                        y_offset = 0
                        for line in lines:
                            if not line.strip():
                                continue
                            blocks.append(
                                OCRBlock(
                                    text=line.strip(),
                                    box=[[0, y_offset], [100, y_offset], [100, y_offset+10], [0, y_offset+10]],
                                    confidence=1.0
                                )
                            )
                            y_offset += 20
                        
                is_digital = len(extracted_text.strip()) > 50 * page_count if page_count > 0 else False
                
                logger.info(
                    "PDF Analysis completed",
                    extra={
                        "metrics": {
                            "filename": filename,
                            "page_count": page_count,
                            "file_size_mb": round(file_size_mb, 2),
                            "is_digital": is_digital
                        }
                    }
                )

                # Heuristic OCR routing:
                # If page count is < 3 and file size < 2MB, route to RapidOCR (via pdf2image conversion) or PyPDF digital text.
                if page_count < 3 and file_size_mb < 2.0:
                    if is_digital and extracted_text.strip():
                        logger.info("Routing digital PDF to PyPDF text extractor directly (Fast Heuristic)")
                        avg_block_conf = sum(b.confidence for b in blocks) / len(blocks) if blocks else 1.0
                        return OCRResult(
                            text=extracted_text.strip(),
                            blocks=blocks,
                            confidence=avg_block_conf,
                            provider="PyPDF_FastRoute",
                            processing_time=time.perf_counter() - start_time,
                            page_count=page_count
                        ), source_type
                    
                    logger.info("Routing small scanned PDF to RapidOCR provider directly (Fast Heuristic)")
                    # Convert PDF pages to image arrays and process
                    from pdf2image import convert_from_bytes
                    images = convert_from_bytes(file_bytes, first_page=1, last_page=2)
                    pdf_text_list = []
                    pdf_blocks_list = []
                    conf_list = []
                    for img in images:
                        # Convert PIL Image to BGR ndarray
                        open_cv_image = np.array(img)
                        # Convert RGB to BGR
                        open_cv_image = open_cv_image[:, :, ::-1].copy()
                        raw_text, blocks_out, avg_conf = self.rapid_ocr._process_image_array(open_cv_image)
                        pdf_text_list.append(raw_text)
                        pdf_blocks_list.extend(blocks_out)
                        conf_list.append(avg_conf)
                    
                    combined_text = "\n".join(pdf_text_list)
                    final_conf = sum(conf_list) / len(conf_list) if conf_list else 0.0
                    return OCRResult(
                        text=combined_text,
                        blocks=pdf_blocks_list,
                        confidence=final_conf,
                        provider="RapidOCR_PDF_FastRoute",
                        processing_time=time.perf_counter() - start_time,
                        page_count=page_count
                    ), source_type

                logger.info("Routing Scanned PDF to DoclingProvider...")
                logger.info(f"[OCR_PROVIDER_EXECUTE] provider=Docling file={filename}")
                try:
                    return self._execute_with_retry(self.docling, "extract_text_from_pdf", file_bytes, max_retries=1), source_type
                except Exception as e:
                    logger.error(f"Docling PDF extraction failed: {e}")
                    if extracted_text.strip():
                        logger.info("Falling back to PyPDF extracted text due to Docling failure/missing layoutparser models.")
                        avg_block_conf = sum(b.confidence for b in blocks) / len(blocks) if blocks else 0.5
                        return OCRResult(
                            text=extracted_text.strip(),
                            blocks=blocks,
                            confidence=avg_block_conf,
                            provider="PyPDF_Fallback",
                            processing_time=time.perf_counter() - start_time,
                            page_count=page_count
                        ), source_type
                    raise HTTPException(status_code=500, detail=f"PDF OCR processing failed: {str(e)}")

            except Exception as pdf_err:
                logger.error(f"PDF Processing failed: {pdf_err}")
                if "extracted_text" in locals() and extracted_text.strip():
                    logger.info("Falling back to PyPDF extracted text due to absolute Docling or PDF load failure.")
                    fallback_blocks = blocks if 'blocks' in locals() else []
                    avg_block_conf = sum(b.confidence for b in fallback_blocks) / len(fallback_blocks) if fallback_blocks else 0.5
                    return OCRResult(
                        text=extracted_text.strip(),
                        blocks=fallback_blocks,
                        confidence=avg_block_conf,
                        provider="PyPDF_Fallback",
                        processing_time=time.perf_counter() - start_time,
                        page_count=page_count if 'page_count' in locals() else 1
                    ), source_type
                raise HTTPException(status_code=500, detail=f"PDF OCR processing failed completely: {str(pdf_err)}")
        else:
            try:
                logger.info("Routing Image to RapidOCRProvider...")
                logger.info(f"[OCR_PROVIDER_EXECUTE] provider=RapidOCR file={filename}")
                return self._execute_with_retry(self.rapid_ocr, "extract_text_from_image", file_bytes, max_retries=2), source_type
            except Exception as rapid_err:
                logger.error(f"RapidOCR Image extraction failed: {rapid_err}")
                raise HTTPException(status_code=500, detail="Image OCR failed completely.")

