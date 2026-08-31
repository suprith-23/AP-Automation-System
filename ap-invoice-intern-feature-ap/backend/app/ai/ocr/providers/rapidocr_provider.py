import time
import io
import os
import gc
import tempfile
import logging
from typing import Union, List, Tuple
from threading import Lock
import numpy as np
import cv2
from pdf2image import convert_from_bytes
from rapidocr import RapidOCR

from app.ai.ocr.providers.base import OCRProvider
from app.ai.ocr.models import OCRResult, OCRBlock
from app.ai.ocr_engine import RapidOCREngine
from app.utils.memory_utils import get_process_memory_mb

logger = logging.getLogger("ap_automation.rapidocr_provider")

class RapidOCRProvider(OCRProvider):
    _instance = None
    _lock = Lock()

    def __init__(self):
        self.max_width = int(os.getenv("MAX_IMAGE_WIDTH", "1500"))
        from app.core.config import CONFIG
        self.conf_threshold = float(os.getenv("OCR_CONFIDENCE_THRESHOLD", str(CONFIG.validation_rules.get("confidence_threshold", 0.3))))
        logger.info("[OCR_PROVIDER_LOAD] provider=RapidOCR")
        self.warm_up()

    @classmethod
    def get_instance(cls) -> "RapidOCRProvider":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @property
    def provider_name(self) -> str:
        return "RapidOCR"

    def warm_up(self) -> None:
        if not hasattr(self, "engine"):
            logger.info("Initializing RapidOCR engine via singleton registry...")
            t0 = time.perf_counter()
            mem_before = get_process_memory_mb()
            
            self.engine = RapidOCREngine.get_instance()
            
            mem_after = get_process_memory_mb()
            startup_time = time.perf_counter() - t0
            logger.info(f"[OCR] RapidOCR startup: {startup_time:.2f}s")
            logger.info(f"[OCR] Memory before: {mem_before:.0f} MB")
            logger.info(f"[OCR] Memory after: {mem_after:.0f} MB")
            logger.info(f"[OCR] Delta: +{mem_after - mem_before:.0f} MB")

    def _resize_image(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        if w > self.max_width:
            ratio = self.max_width / float(w)
            new_h = int(h * ratio)
            img = cv2.resize(img, (self.max_width, new_h), interpolation=cv2.INTER_LANCZOS4)
        return img

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        normalized = text.replace("\r\n", "\n").replace("\r", "\n")
        # Strip potentially malicious control characters or escape template parameters
        printable_chars = [char for char in normalized if char.isprintable() or char in ("\n", "\t")]
        cleaned = "".join(printable_chars)
        
        # Escape curly braces to prevent prompt formatting/injection attacks
        cleaned = cleaned.replace("{", "[").replace("}", "]")
        
        lines = cleaned.split("\n")
        cleaned_lines = []
        noise_symbols = {"|", "_", "~", "-", "=", "*", "═", "─", "╪"}
        
        for line in lines:
            stripped_line = line.strip()
            if stripped_line and all(c in noise_symbols or c.isspace() for c in stripped_line):
                continue
            cleaned_lines.append(stripped_line)
            
        final_lines = []
        prev_was_empty = False
        for line in cleaned_lines:
            if not line:
                if not prev_was_empty:
                    final_lines.append("")
                    prev_was_empty = True
            else:
                final_lines.append(line)
                prev_was_empty = False
                
        return "\n".join(final_lines).strip()

    def _preprocess_image(self, img: np.ndarray) -> np.ndarray:
        """Apply noise reduction, deskewing, and contrast enhancement."""
        # 1. Grayscale
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()

        # 2. Deskew (OpenCV minAreaRect)
        gray_inv = cv2.bitwise_not(gray)
        # Threshold to get text areas
        _, thresh = cv2.threshold(gray_inv, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) > 0:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            
            # Only rotate if angle is significant (> 0.5 deg and < 45 deg)
            if 0.5 < abs(angle) < 45:
                (h, w) = img.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                if len(img.shape) == 3:
                    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                else:
                    gray = img.copy()

        # 3. Contrast enhancement (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # RapidOCR expects BGR format
        final_img = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
        
        return final_img

    def _parse_ocr_output(self, ocr_out) -> List[OCRBlock]:
        blocks = []
        if ocr_out is None:
            return blocks

        if hasattr(ocr_out, "txts") and hasattr(ocr_out, "scores"):
            txts = ocr_out.txts or []
            scores = ocr_out.scores or []
            boxes = ocr_out.boxes
            for i, text in enumerate(txts):
                score = float(scores[i]) if i < len(scores) else 1.0
                box = boxes[i] if boxes is not None and i < len(boxes) else None
                if score >= self.conf_threshold:
                    blocks.append(OCRBlock(text=text, box=box, confidence=score))
        elif isinstance(ocr_out, (list, tuple)):
            if len(ocr_out) == 2:
                result, _ = ocr_out
            else:
                result = ocr_out
                
            for line in result:
                if len(line) >= 3:
                    box, text, score = line[0], line[1], float(line[2])
                    if score >= self.conf_threshold:
                        blocks.append(OCRBlock(text=text, box=box, confidence=score))
        return blocks

    def _process_image_array(self, img_array: np.ndarray) -> Tuple[str, List[OCRBlock], float]:
        resized_img = self._resize_image(img_array)
        
        # Strategy 1: OCR directly on raw resized image
        ocr_out_raw = self.engine(resized_img)
        blocks_raw = self._parse_ocr_output(ocr_out_raw)
        avg_conf_raw = sum(b.confidence for b in blocks_raw) / len(blocks_raw) if blocks_raw else 0.0
        
        # Dual-routing selection logic optimization:
        # If the raw extraction is highly confident, bypass preprocessing and the second OCR run to save time.
        if avg_conf_raw >= 0.82 and len(blocks_raw) >= 5:
            logger.info(f"RapidOCR: Selected RAW route directly and bypassed PREPROCESSED (conf={avg_conf_raw:.2f}, blocks={len(blocks_raw)})")
            raw_text = "\n".join([b.text for b in blocks_raw])
            return raw_text, blocks_raw, avg_conf_raw

        # Strategy 2: OCR on preprocessed image (contrast enhanced + deskewed)
        preprocessed_img = self._preprocess_image(resized_img)
        ocr_out_prep = self.engine(preprocessed_img)
        blocks_prep = self._parse_ocr_output(ocr_out_prep)
        avg_conf_prep = sum(b.confidence for b in blocks_prep) / len(blocks_prep) if blocks_prep else 0.0
        
        # Dual-routing selection logic:
        # Prefer the raw/unprocessed route if it yields higher confidence or equal/better block density.
        # Often preprocessing highlights watermarks and introduces noise characters.
        if avg_conf_raw > avg_conf_prep + 0.05 or (abs(avg_conf_raw - avg_conf_prep) <= 0.05 and len(blocks_raw) >= len(blocks_prep)):
            logger.info(f"RapidOCR: Selected RAW route (conf={avg_conf_raw:.2f}, blocks={len(blocks_raw)}) over PREPROCESSED (conf={avg_conf_prep:.2f}, blocks={len(blocks_prep)})")
            selected_blocks = blocks_raw
            selected_conf = avg_conf_raw
        else:
            logger.info(f"RapidOCR: Selected PREPROCESSED route (conf={avg_conf_prep:.2f}, blocks={len(blocks_prep)}) over RAW (conf={avg_conf_raw:.2f}, blocks={len(blocks_raw)})")
            selected_blocks = blocks_prep
            selected_conf = avg_conf_prep

        raw_text = "\n".join([b.text for b in selected_blocks])
        return raw_text, selected_blocks, selected_conf

    def extract_text_from_image(self, image: Union[bytes, np.ndarray]) -> OCRResult:
        start_time = time.perf_counter()
        
        try:
            if isinstance(image, bytes):
                img_array = np.frombuffer(image, dtype=np.uint8)
                img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                if img is None:
                    raise ValueError("Could not decode image bytes.")
            else:
                img = image

            raw_text, blocks, avg_conf = self._process_image_array(img)
            cleaned_text = self._clean_text(raw_text)
            
            processing_time = time.perf_counter() - start_time
            return OCRResult(
                text=cleaned_text,
                blocks=blocks,
                confidence=avg_conf,
                provider=self.provider_name,
                processing_time=processing_time,
                page_count=1
            )
        except Exception as e:
            logger.error(f"RapidOCR image extraction failed: {str(e)}")
            raise e

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> OCRResult:
        start_time = time.perf_counter()
        blocks = []
        text_segments = []
        confidences = []
        page_count = 0
        
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_pdf:
                temp_pdf.write(pdf_bytes)
                temp_pdf_path = temp_pdf.name

            # Process pages sequentially to limit memory footprint
            # pdf2image allows generating images one by one or in batches
            try:
                from pdf2image.pdf2image import pdfinfo_from_path
                info = pdfinfo_from_path(temp_pdf_path)
                total_pages = info["Pages"]
                page_count = total_pages
                
                # Process in batches of 1 to keep memory minimal
                for page_num in range(1, total_pages + 1):
                    images = convert_from_bytes(pdf_bytes, first_page=page_num, last_page=page_num)
                    if not images:
                        continue
                    img = images[0]
                    try:
                        open_cv_image = np.array(img)
                        open_cv_image = open_cv_image[:, :, ::-1].copy() # RGB to BGR
                        
                        raw_text, page_blocks, avg_conf = self._process_image_array(open_cv_image)
                        
                        if raw_text.strip():
                            text_segments.append(raw_text)
                            blocks.extend(page_blocks)
                            confidences.append(avg_conf)
                    finally:
                        try:
                            img.close()
                        except:
                            pass
                    
                    # Force GC after each page
                    del images
                    gc.collect()

            finally:
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)
            
            final_text = self._clean_text("\n".join(text_segments))
            overall_conf = sum(confidences) / len(confidences) if confidences else 0.0
            processing_time = time.perf_counter() - start_time

            return OCRResult(
                text=final_text,
                blocks=blocks,
                confidence=overall_conf,
                provider=self.provider_name,
                processing_time=processing_time,
                page_count=page_count
            )
        except Exception as e:
            logger.error(f"RapidOCR PDF extraction failed: {str(e)}")
            raise e
