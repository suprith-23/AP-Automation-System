import time
import psutil
import os
from fastapi import APIRouter
from app.ai.ocr_engine import RapidOCREngine
from app.ai.docling_engine import DoclingEngine
from app.utils.memory_utils import get_process_memory_mb

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])

@router.get("/ocr")
def get_ocr_health():
    rapid_status = "unloaded"
    docling_status = "unloaded"
    
    # Check if instances exist without initializing them
    if RapidOCREngine._instance is not None:
        rapid_status = "loaded"
    if DoclingEngine._instance is not None:
        docling_status = "loaded"
        
    return {
        "memory_mb": round(get_process_memory_mb(), 2),
        "providers": {
            "RapidOCR": {
                "status": rapid_status
            },
            "Docling": {
                "status": docling_status
            }
        }
    }
