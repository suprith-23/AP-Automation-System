import logging
from threading import Lock
# docling import deferred to get_instance

logger = logging.getLogger("ap_automation.docling_engine")

class DoclingEngine:
    """Thread-safe singleton wrapper for the Docling DocumentConverter to prevent per-request re-initialization."""
    _instance = None
    _lock = Lock()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    from docling.document_converter import DocumentConverter
                    logger.info("Initializing Docling DocumentConverter engine singleton...")
                    cls._instance = DocumentConverter()
        return cls._instance

    @classmethod
    def warm_up(cls):
        """Warm up the engine if not already initialized."""
        cls.get_instance()
