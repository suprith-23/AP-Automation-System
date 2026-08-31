import os
import json
import asyncio
from pathlib import Path
import sys

BASE_DIR = Path(r"n:\PGM\AP-Automation-System")
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

sys.path.append(str(BASE_DIR / "backend"))

from app.ai.services.ocr_service import extract_text_from_file_pipeline
from app.ai.extraction.pipeline import ExtractionPipeline
from app.ai.extraction.schema_normalization import SchemaNormalization

IMAGES_DIR = BASE_DIR / "testing" / "datasets" / "legacy_benchmark_dataset" / "images"
GT_DIR = BASE_DIR / "testing" / "datasets" / "legacy_benchmark_dataset" / "ground_truth"

fields_to_check = [
    "total_taxable_value",
    "total_invoice_value",
    "total_cgst_value",
    "total_sgst_value",
    "total_igst_value",
    "total_ces_value"
]

async def process_all():
    print("# Invoice-by-Invoice Monetary Comparison")
    print("| Invoice | Field | Original GT Value | Normalized GT Value | Extracted Value | Status |")
    print("|---|---|---|---|---|---|")
    
    for filename in sorted(os.listdir(IMAGES_DIR)):
        if filename.startswith("."): continue
        image_path = IMAGES_DIR / filename
        gt_path = GT_DIR / f"{os.path.splitext(filename)[0]}.json"
        
        if not gt_path.exists(): continue
        
        with open(gt_path, "r", encoding="utf-8") as f:
            original_gt = json.load(f)
            
        normalized_gt = SchemaNormalization.normalize(original_gt)
        
        with open(image_path, "rb") as f:
            file_bytes = f.read()
            
        ocr_result = await asyncio.to_thread(extract_text_from_file_pipeline, file_bytes, image_path.name)
        extracted_data = await ExtractionPipeline.process(ocr_result["ocr_result"])
        extracted_invoice = extracted_data.get("invoice_data", extracted_data)
        
        for field in fields_to_check:
            orig_val = original_gt.get(field)
            norm_val = normalized_gt.get(field)
            ext_val = extracted_invoice.get(field)
            
            status = "Mismatch (GT vs Extracted)" if str(norm_val) != str(ext_val) else "Match"
            if orig_val is None and norm_val == 0.0 and ext_val not in (None, 0.0):
                status = "GT was None, but norm forced 0.0, causing mismatch!"
                
            print(f"| {filename} | {field} | {orig_val} | {norm_val} | {ext_val} | {status} |")

if __name__ == "__main__":
    asyncio.run(process_all())
