from typing import Dict, Any, List

class Stage6Confidence:
    """
    Adjusts and assigns confidence scores to extracted values.
    Factors in layout consistency and multiple candidate conflicts.
    """

    @staticmethod
    def refine_confidence(grouped_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adjusts confidence scores in the grouped data based on heuristics, methods, and block confidence.
        """
        refined = dict(grouped_data)

        # Helper to factor block confidence
        def adjust_list_confidence(candidates: List[Dict[str, Any]], block_confidence: float = 1.0):
            if not candidates:
                return
            
            # Penalize if multiple candidates
            penalty = 0.2 if len(candidates) > 1 else -0.05
            
            for cand in candidates:
                base_conf = cand.get("confidence", 0.9)
                method = cand.get("method", "")
                
                # Boost specific methods
                if method.startswith("regex_"):
                    base_conf += 0.05
                elif method == "strategy_c_spatial":
                    base_conf += 0.05
                    
                final_conf = (base_conf - penalty) * block_confidence
                cand["confidence"] = min(1.0, max(0.0, final_conf))

        # We can extract average block confidence per semantic block
        def get_avg_block_conf(blocks: List[Dict[str, Any]]) -> float:
            if not blocks:
                return 1.0
            return sum(b.get("confidence", 1.0) for b in blocks) / len(blocks)

        # Refine Vendor GSTINs/PANs
        vendor_block = refined.get("vendor_block", {})
        v_conf = get_avg_block_conf(vendor_block.get("blocks", []))
        adjust_list_confidence(vendor_block.get("possible_gstins", []), v_conf)
        adjust_list_confidence(vendor_block.get("possible_pans", []), v_conf)

        # Refine Invoice Numbers/Dates
        invoice_block = refined.get("invoice_block", {})
        i_conf = get_avg_block_conf(invoice_block.get("blocks", []))
        adjust_list_confidence(invoice_block.get("possible_invoice_numbers", []), i_conf)
        adjust_list_confidence(invoice_block.get("possible_dates", []), i_conf)

        # Refine Bank IFSCs
        bank_block = refined.get("bank_block", {})
        b_conf = get_avg_block_conf(bank_block.get("blocks", []))
        adjust_list_confidence(bank_block.get("possible_ifscs", []), b_conf)

        return refined
