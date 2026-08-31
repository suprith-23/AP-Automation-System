from pydantic import BaseModel
from typing import List, Optional, Any

class OCRBlock(BaseModel):
    text: str
    box: Optional[List[List[float]]] = None
    confidence: float

class OCRResult(BaseModel):
    text: str
    blocks: List[OCRBlock]
    confidence: float
    provider: str
    processing_time: float
    page_count: int
