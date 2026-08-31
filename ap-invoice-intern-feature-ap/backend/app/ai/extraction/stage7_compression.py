import json
from typing import Dict, Any

class Stage7Compression:
    """
    Compresses grouped data into a minimal token representation.
    """

    @staticmethod
    def compress_for_llm(grouped_data: Dict[str, Any]) -> str:
        """
        Takes the refined groups and strips out unnecessary raw text 
        if we already have high-confidence structured extraction.
        Since we want the LLM to do semantic resolution, we provide the blocks.
        """
        # Create a condensed version
        condensed = {}
        
        # Vendor Block
        condensed["Vendor_Context"] = {
            "text": grouped_data.get("vendor_block", {}).get("text", "").strip(),
            "candidates": {
                "gstins": grouped_data.get("vendor_block", {}).get("possible_gstins", []),
                "pans": grouped_data.get("vendor_block", {}).get("possible_pans", [])
            }
        }
        
        # Invoice Block
        condensed["Invoice_Context"] = {
            "text": grouped_data.get("invoice_block", {}).get("text", "").strip(),
            "candidates": {
                "invoice_numbers": grouped_data.get("invoice_block", {}).get("possible_invoice_numbers", []),
                "dates": grouped_data.get("invoice_block", {}).get("possible_dates", [])
            }
        }
        
        # Buyer Block
        condensed["Buyer_Context"] = {
            "text": grouped_data.get("buyer_block", {}).get("text", "").strip()
        }
        
        # Bank Block
        condensed["Bank_Context"] = {
            "text": grouped_data.get("bank_block", {}).get("text", "").strip(),
            "candidates": {
                "ifscs": grouped_data.get("bank_block", {}).get("possible_ifscs", [])
            }
        }
        
        # Totals
        condensed["Totals_Context"] = grouped_data.get("totals_block", {}).get("text", "").strip()
        
        # Unclassified / Footer - include if not empty
        footer = grouped_data.get("footer_block", {}).get("text", "").strip()
        if footer:
            condensed["Footer_Context"] = footer
            
        unclass = grouped_data.get("unclassified_block", {}).get("text", "").strip()
        if unclass:
            condensed["Other_Context"] = unclass
            
        # Line items
        line_items = grouped_data.get("line_items", [])
        if line_items:
            # Only include if there are items
            condensed["Line_Items"] = line_items
            
        # Clean up empty contexts
        keys_to_remove = []
        for k, v in condensed.items():
            if isinstance(v, dict):
                if not v.get("text") and not any(v.get("candidates", {}).values()):
                    keys_to_remove.append(k)
            elif not v:
                keys_to_remove.append(k)
                
        for k in keys_to_remove:
            del condensed[k]
            
        return json.dumps(condensed, separators=(',', ':'))
