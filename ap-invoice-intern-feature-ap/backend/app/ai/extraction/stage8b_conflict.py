import logging
from typing import Dict, Any, List

logger = logging.getLogger("ap_automation.stage8b_conflict")

class Stage8bConflictResolution:
    """
    Resolves conflicts between Deterministic/Layout extraction and LLM extraction.
    Prioritizes deterministic methods with high confidence over LLM guesses.
    Outputs provenance metadata for each field.
    """

    @staticmethod
    def _find_best_deterministic(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not candidates:
            return {}
        # Sort by confidence descending
        sorted_cands = sorted(candidates, key=lambda x: x.get("confidence", 0.0), reverse=True)
        return sorted_cands[0]

    @staticmethod
    def resolve(
        llm_output: Dict[str, Any],
        grouped_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge LLM output with deterministic fields.
        Returns:
            - invoice_data: flat dict for backwards compatibility
            - metadata: rich provenance for each field
        """
        invoice_data = llm_output.get("invoice_data", {})
        llm_conf = llm_output.get("confidence", {})
        
        metadata = {}
        resolved_invoice_data = dict(invoice_data)

        # 1. Resolve Invoice Number
        inv_cands = grouped_data.get("invoice_block", {}).get("possible_invoice_numbers", [])
        best_inv = Stage8bConflictResolution._find_best_deterministic(inv_cands)
        llm_inv = invoice_data.get("invoice_number")
        
        if best_inv and best_inv.get("confidence", 0.0) >= 0.8:
            if llm_inv != best_inv["value"]:
                resolved_invoice_data["invoice_number"] = best_inv["value"]
                metadata["invoice_number"] = {
                    "value": best_inv["value"],
                    "confidence": best_inv["confidence"],
                    "source": "deterministic",
                    "method": best_inv.get("method", "regex"),
                    "reason": "Deterministic extraction override (high confidence)"
                }
            else:
                metadata["invoice_number"] = {
                    "value": best_inv["value"],
                    "confidence": max(best_inv["confidence"], llm_conf.get("invoice_number", 0.8)),
                    "source": "agreement",
                    "method": "llm+regex",
                    "reason": "Deterministic and LLM agree"
                }
        else:
            if llm_inv:
                metadata["invoice_number"] = {
                    "value": llm_inv,
                    "confidence": llm_conf.get("invoice_number", 0.7),
                    "source": "llm",
                    "method": "llm",
                    "reason": "LLM extraction only"
                }

        # 2. Resolve GSTINs (Seller and Buyer)
        gstin_cands = grouped_data.get("vendor_block", {}).get("possible_gstins", [])
        best_gstin = Stage8bConflictResolution._find_best_deterministic(gstin_cands)
        llm_seller_gstin = invoice_data.get("seller_gstin")
        
        if best_gstin and best_gstin.get("confidence", 0.0) >= 0.8:
            if llm_seller_gstin != best_gstin["value"]:
                resolved_invoice_data["seller_gstin"] = best_gstin["value"]
                metadata["seller_gstin"] = {
                    "value": best_gstin["value"],
                    "confidence": best_gstin["confidence"],
                    "source": "deterministic",
                    "method": best_gstin.get("method", "regex_gstin"),
                    "reason": "Deterministic extraction override (high confidence)"
                }
            else:
                metadata["seller_gstin"] = {
                    "value": best_gstin["value"],
                    "confidence": max(best_gstin["confidence"], llm_conf.get("seller_gstin", 0.8)),
                    "source": "agreement",
                    "method": "llm+regex",
                    "reason": "Deterministic and LLM agree"
                }
        else:
            if llm_seller_gstin:
                metadata["seller_gstin"] = {
                    "value": llm_seller_gstin,
                    "confidence": llm_conf.get("seller_gstin", 0.7),
                    "source": "llm",
                    "method": "llm",
                    "reason": "LLM extraction only"
                }

        # 3. Monetary Derivation Fallback
        # If total is present but subtotal/tax are missing or zero, try to derive if we know the tax rate (e.g. 18%)
        # Here we just document the fallback, and try a simple math fix if exactly one component is missing.
        taxable = float(resolved_invoice_data.get("total_taxable_value") or 0.0)
        cgst = float(resolved_invoice_data.get("total_cgst_value") or 0.0)
        sgst = float(resolved_invoice_data.get("total_sgst_value") or 0.0)
        igst = float(resolved_invoice_data.get("total_igst_value") or 0.0)
        grand_total = float(resolved_invoice_data.get("total_invoice_value") or 0.0)
        
        # Fallback 1: Missing taxable, but have taxes and total
        if taxable == 0.0 and grand_total > 0.0 and (cgst > 0 or sgst > 0 or igst > 0):
            derived_taxable = grand_total - (cgst + sgst + igst)
            if derived_taxable > 0:
                resolved_invoice_data["total_taxable_value"] = derived_taxable
                metadata["total_taxable_value"] = {
                    "value": derived_taxable,
                    "confidence": 0.5,
                    "source": "derived",
                    "method": "math_derivation",
                    "reason": "Derived from Total - Taxes"
                }

        # Fallback 2: Missing taxes entirely, but have taxable and total
        elif (cgst == 0.0 and sgst == 0.0 and igst == 0.0) and grand_total > 0.0 and taxable > 0.0:
            derived_tax = grand_total - taxable
            if derived_tax > 0:
                # We can't know if it's CGST/SGST or IGST without state codes, so put it in IGST for math balance,
                # or better, just leave it as an aggregate. We will assign it to IGST as a generic "Total Tax" placeholder for validation.
                resolved_invoice_data["total_igst_value"] = derived_tax
                metadata["total_igst_value"] = {
                    "value": derived_tax,
                    "confidence": 0.5,
                    "source": "derived",
                    "method": "math_derivation",
                    "reason": "Derived from Total - Taxable"
                }

        # Fallback 3: Auto-correction for Stage 9 Totals Hallucination / Line items sum discrepancy
        # If grand_total mismatch with subtotal + tax, attempt auto-correction from line_items or component sums
        items = resolved_invoice_data.get("items") or resolved_invoice_data.get("line_items") or []
        items_sum = 0.0
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    val = item.get("total_amount") or item.get("assessable_value") or item.get("total_item_value") or item.get("amount") or item.get("total") or 0.0
                    try:
                        items_sum += float(val)
                    except (ValueError, TypeError):
                        pass

        cess = float(resolved_invoice_data.get("total_ces_value") or 0.0)
        tax_sum = cgst + sgst + igst + cess
        if tax_sum == 0.0 and resolved_invoice_data.get("tax_amount"):
            try:
                tax_sum = float(resolved_invoice_data.get("tax_amount"))
            except (ValueError, TypeError):
                pass

        if items_sum > 0:
            expected_from_items = items_sum + tax_sum
            if grand_total > 0 and abs(grand_total - expected_from_items) > 1.0:
                logger.warning(
                    f"Stage 8b Auto-Correction Triggered: Overriding grand_total ({grand_total}) "
                    f"with sum of line items ({items_sum}) + tax ({tax_sum}) = {expected_from_items}"
                )
                resolved_invoice_data["total_invoice_value"] = expected_from_items
                resolved_invoice_data["subtotal"] = items_sum
                resolved_invoice_data["total_taxable_value"] = items_sum
                metadata["total_invoice_value"] = {
                    "value": expected_from_items,
                    "confidence": 0.85,
                    "source": "auto_corrected",
                    "method": "line_items_sum_autocorrect",
                    "reason": "Stage 8b auto-corrected totals hallucination using line_items sum + tax"
                }

        # Check and route barcode data in item_number to item_barcode
        items_list = resolved_invoice_data.get("items") or resolved_invoice_data.get("line_items") or []
        if isinstance(items_list, list):
            for idx, item in enumerate(items_list):
                if isinstance(item, dict):
                    item_num = item.get("item_number")
                    if item_num is not None:
                        try:
                            val = int(float(str(item_num).strip()))
                            # If it's a barcode (e.g. > 6 digits or > 999999)
                            if val > 999999:
                                item["item_barcode"] = str(val)
                                item["item_number"] = idx + 1
                                logger.info(f"Stage 8b: Routed large item_number {val} to item_barcode for item {idx + 1}")
                            else:
                                item["item_barcode"] = item.get("item_barcode") or None
                        except (ValueError, TypeError):
                            item["item_barcode"] = item.get("item_barcode") or None
                    else:
                        item["item_barcode"] = item.get("item_barcode") or None

        # Fill remaining fields gracefully
        for k, v in resolved_invoice_data.items():
            if k not in metadata:
                metadata[k] = {
                    "value": v,
                    "confidence": llm_conf.get(k, 0.7) if isinstance(llm_conf, dict) else 0.7,
                    "source": "llm",
                    "method": "llm",
                    "reason": "LLM fallback"
                }

        return {
            "invoice_data": resolved_invoice_data,
            "extraction_metadata": metadata
        }
