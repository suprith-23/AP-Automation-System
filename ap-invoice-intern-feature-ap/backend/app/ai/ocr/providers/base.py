from abc import ABC, abstractmethod
from typing import Union
from app.ai.ocr.models import OCRResult
import numpy as np

class OCRProvider(ABC):
    """
    Abstract Base Class for OCR Providers.
    All OCR engines must implement this contract.
    """

    @abstractmethod
    def extract_text_from_image(self, image: Union[bytes, np.ndarray]) -> OCRResult:
        """
        Extract text from an image.
        """
        pass

    @abstractmethod
    def extract_text_from_pdf(self, pdf_bytes: bytes) -> OCRResult:
        """
        Extract text from a PDF document.
        """
        pass

    @abstractmethod
    def warm_up(self) -> None:
        """
        Initialize and warm up the underlying models/engines.
        """
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """
        Return the name of the provider (e.g., 'RapidOCR', 'Docling').
        """
        pass
