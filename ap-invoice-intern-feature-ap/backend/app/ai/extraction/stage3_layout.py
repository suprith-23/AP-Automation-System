import re
from typing import Dict, List
from app.ai.ocr.models import OCRBlock

class Stage3Layout:
    """
    Performs document understanding before LLM extraction.
    Partitions the cleaned OCR text into logical blocks using keyword heuristics.
    """

    @staticmethod
    def partition_text(text: str, blocks: List['OCRBlock'] = None) -> Dict[str, str]:
        """
        Splits text into conceptual blocks based on line heuristics.
        Regions: metadata, vendor, buyer, line_items, totals, bank, footer
        """
        lines = text.split('\n')
        
        blocks = {
            "metadata": [],
            "vendor": [],
            "buyer": [],
            "line_items": [],
            "totals": [],
            "bank": [],
            "footer": [],
            "unclassified": []
        }
        
        current_block = "vendor" # default start block is usually vendor
        
        # Keywords for state transitions
        kw_metadata = [r"(?i)\b(invoice no|invoice date|date|po number|order no|gstin|pan|ref)\b"]
        kw_line_items = [r"(?i)\b(sl no|s\.no|item|description|qty|quantity|hsn|rate|amount|particulars)\b"]
        kw_totals = [r"(?i)\b(subtotal|sub total|cgst|sgst|igst|tax amount|grand total|total amount)\b"]
        kw_bank = [r"(?i)\b(bank|account|ac no|a/c|ifsc|swift|branch)\b"]
        kw_buyer = [r"(?i)\b(bill to|billed to|ship to|buyer|customer)\b"]
        kw_footer = [r"(?i)\b(terms and conditions|declaration|authorized signatory|thank you|e\. & o\.e)\b"]

        def matches_any(line: str, patterns: List[str]) -> bool:
            return any(re.search(p, line) for p in patterns)

        in_table = False
        
        for idx, line in enumerate(lines):
            # Evaluate block transitions based on content
            if not in_table and matches_any(line, kw_line_items) and len(line.split()) >= 3:
                current_block = "line_items"
                in_table = True
            elif in_table and matches_any(line, kw_totals):
                current_block = "totals"
                in_table = False
            elif matches_any(line, kw_bank):
                current_block = "bank"
            elif matches_any(line, kw_buyer):
                current_block = "buyer"
            elif matches_any(line, kw_footer):
                current_block = "footer"
            elif current_block == "vendor" and matches_any(line, kw_metadata):
                current_block = "metadata"
                
            blocks[current_block].append(line)
            
        return {k: '\n'.join(v) for k, v in blocks.items() if v}
