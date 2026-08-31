import logging
from threading import Lock
from rapidocr import RapidOCR

logger = logging.getLogger("ap_automation.ocr_engine")

class RapidOCREngine:
    """Thread-safe singleton wrapper for the RapidOCR engine to prevent per-request re-initialization."""
    _instance = None
    _lock = Lock()

    @classmethod
    def get_instance(cls) -> RapidOCR:
        import os
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    logger.info("Initializing RapidOCR engine singleton...")
                    cls._instance = RapidOCR()
        return cls._instance

    @classmethod
    def warm_up(cls):
        """Warm up the engine if not already initialized."""
        cls.get_instance()
