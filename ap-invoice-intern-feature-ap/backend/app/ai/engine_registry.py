import logging
import anyio
from app.ai.ocr_engine import RapidOCREngine
from app.ai.docling_engine import DoclingEngine

logger = logging.getLogger("ap_automation.engine_registry")

async def pre_warm_engines_async():
    """Asynchronously warm up machine learning model singletons to prevent latency on first user request."""
    import os
    if os.environ.get("TESTING") == "True":
        logger.info("Skipping model pre-warming in testing mode.")
        return

    logger.info("Starting OCR and Document Parsing model pre-warming in background thread pool...")
    try:
        # Run synchronous initializations inside anyio thread pool to avoid blocking FastAPI's event loop
        await anyio.to_thread.run_sync(RapidOCREngine.warm_up)
        if os.environ.get("PRE_WARM_DOCLING", "False").lower() == "true":
            await anyio.to_thread.run_sync(DoclingEngine.warm_up)
            logger.info("OCR and Docling models pre-warmed successfully!")
        else:
            logger.info("RapidOCR pre-warmed. Skipping Docling pre-warming to conserve RAM and CPU.")
    except Exception as e:
        logger.error(f"Failed to pre-warm model engines: {e}", exc_info=True)

