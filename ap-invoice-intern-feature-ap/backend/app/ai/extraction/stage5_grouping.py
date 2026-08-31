from typing import Dict, Any, List
from app.ai.ocr.models import OCRBlock

class Stage5Grouping:
    """
    Combines deterministic extraction and layout analysis into semantic groups.
    Organizes information into blocks to minimize context spread.
    """

    @staticmethod
    def group_fields(
        deterministic_fields: Dict[str, Any],
        layout_blocks: Dict[str, str],
        table_rows: list,
        clean_blocks: List[OCRBlock] = None
    ) -> Dict[str, Any]:
        """
        Create a nested structure representing semantic blocks.
        """
        
        # We can map clean_blocks back to their corresponding layout_blocks strings 
        # for a more structured representation if needed. For now, we store both text and matching blocks.
        
        def get_matching_blocks(text_section: str) -> List[dict]:
            if not clean_blocks or not text_section:
                return []
            section_lines = set([l.strip() for l in text_section.split('\n') if l.strip()])
            matched = []
            for b in clean_blocks:
                if b.text.strip() in section_lines:
                    matched.append({
                        "text": b.text,
                        "box": b.box,
                        "confidence": b.confidence
                    })
            return matched

        vendor_block = {
            "text": layout_blocks.get("vendor", ""),
            "blocks": get_matching_blocks(layout_blocks.get("vendor", "")),
            "possible_gstins": deterministic_fields.get("gstins", []),
            "possible_pans": deterministic_fields.get("pans", []),
            "possible_vendors": deterministic_fields.get("vendor_names", [])
        }
        
        invoice_block = {
            "text": layout_blocks.get("metadata", ""),
            "blocks": get_matching_blocks(layout_blocks.get("metadata", "")),
            "possible_invoice_numbers": deterministic_fields.get("invoice_numbers", []),
            "possible_dates": deterministic_fields.get("dates", [])
        }
        
        buyer_block = {
            "text": layout_blocks.get("buyer", ""),
            "blocks": get_matching_blocks(layout_blocks.get("buyer", ""))
        }
        
        bank_block = {
            "text": layout_blocks.get("bank", ""),
            "blocks": get_matching_blocks(layout_blocks.get("bank", "")),
            "possible_ifscs": deterministic_fields.get("ifscs", [])
        }
        
        contact_block = {
            "possible_emails": deterministic_fields.get("emails", [])
        }
        
        totals_block = {
            "text": layout_blocks.get("totals", ""),
            "blocks": get_matching_blocks(layout_blocks.get("totals", ""))
        }
        
        footer_block = {
            "text": layout_blocks.get("footer", ""),
            "blocks": get_matching_blocks(layout_blocks.get("footer", ""))
        }

        unclassified_block = {
            "text": layout_blocks.get("unclassified", ""),
            "blocks": get_matching_blocks(layout_blocks.get("unclassified", ""))
        }
        
        return {
            "vendor_block": vendor_block,
            "invoice_block": invoice_block,
            "buyer_block": buyer_block,
            "bank_block": bank_block,
            "contact_block": contact_block,
            "totals_block": totals_block,
            "footer_block": footer_block,
            "unclassified_block": unclassified_block,
            "line_items": table_rows
        }
