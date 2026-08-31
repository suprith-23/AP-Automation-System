from typing import Dict, Any
import re

class SchemaNormalization:
    """
    Normalizes field aliases and formats before validation.
    Maps LLM hallucinations or variations to the strict schema.
    """
    
    # Map alias -> canonical field name
    @classmethod
    def get_alias_map(cls):
        try:
            from app.core.config import CONFIG
            return CONFIG.schema_config.get("alias_map", {})
        except Exception:
            return {}

    @classmethod
    def get_numeric_fields(cls):
        try:
            from app.core.config import CONFIG
            return CONFIG.schema_config.get("numeric_fields", [])
        except Exception:
            return []
    
    @staticmethod
    def _clean_numeric(value: Any, default: float = 0.0) -> float:
        """Converts strings like '₹1,23,456.00', '18%', 'INR 5000' to float."""
        if value is None or value == "":
            return default
        if isinstance(value, (int, float)):
            return float(value)
            
        text = str(value).upper()
        # Remove currency symbols, commas, percent, and spaces
        text = re.sub(r'[₹$,%\s]', '', text)
        try:
            return float(text)
        except ValueError:
            return default

    @staticmethod
    def _clean_int(value: Any, default: int = 0) -> int:
        """Coerces arbitrary values to int."""
        if value is None or value == "":
            return default
        try:
            return int(float(str(value).strip()))
        except ValueError:
            return default

    @staticmethod
    def normalize(invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        
        # 1. Map aliases
        alias_map = SchemaNormalization.get_alias_map()
        # Keys that are pipeline-internal and must never reach the Invoice SQLAlchemy model
        _INTERNAL_KEYS = {
            "confidence", "extraction_metadata", "prompt_version",
            "debug_compressed_tokens", "ocr_duration_ms", "llm_duration_ms",
            "total_duration_ms", "validation_errors"
        }
        for k, v in invoice_data.items():
            if k in _INTERNAL_KEYS:
                continue
            canonical = alias_map.get(k.lower(), k)
            if canonical not in normalized or normalized[canonical] is None:
                normalized[canonical] = v
                
        # Define all expected schema float/int fields to prevent Pydantic errors
        float_fields = [
            "total_taxable_value", "total_cgst_value", "total_sgst_value",
            "total_igst_value", "round_off_amount", "total_invoice_value",
            "total_tax_amount", "total_gst_rate", "total_ces_value",
            "total_st_ces_value", "total_discount_value", "total_accessment_value"
        ]
        int_fields = [
            "seller_gstin_pincode", "buyer_gstin_pincode", "shipping_gstin_pincode"
        ]

        for field in float_fields:
            normalized[field] = SchemaNormalization._clean_numeric(normalized.get(field))

        for field in int_fields:
            normalized[field] = SchemaNormalization._clean_int(normalized.get(field))
            
        # 2. Normalize items array
        items = normalized.get("items", [])
        if not isinstance(items, list):
            items = []
            
        normalized_items = []
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
                
            norm_item = {}
            for k, v in item.items():
                norm_item[k] = v
                
            norm_item["item_number"] = SchemaNormalization._clean_int(item.get("item_number"), idx + 1)
            norm_item["item_barcode"] = str(item.get("item_barcode")).strip() if item.get("item_barcode") is not None else None
            norm_item["sl_no"] = str(item.get("sl_no") or idx + 1)
            norm_item["description"] = str(item.get("description") or f"Item {idx + 1}")
            norm_item["hsn_code"] = str(item.get("hsn_code") or "")
            norm_item["unit"] = str(item.get("unit") or "PCS")
            norm_item["is_service"] = str(item.get("is_service") or "N")
            if norm_item["is_service"] not in ("Y", "N"):
                norm_item["is_service"] = "N"
                
            item_floats = [
                "quantity", "unit_price", "total_item_value", "gst_rate",
                "assessable_value", "cgst_amount", "sgst_amount", "igst_amount",
                "total_amount", "discount", "cess_rate", "cess_amount",
                "cess_non_advalorem_amount", "state_cess_rate", "state_cess_amount",
                "other_charges"
            ]
            for field in item_floats:
                norm_item[field] = SchemaNormalization._clean_numeric(item.get(field))
                
            normalized_items.append(norm_item)
            
        normalized["items"] = normalized_items

        # 3. Special handling: total_tax_amount to tax buckets
        total_tax = normalized.get("total_tax_amount", 0.0)
        if total_tax > 0:
            if not normalized.get("total_igst_value") and not normalized.get("total_cgst_value"):
                normalized["total_igst_value"] = total_tax
        else:
            cgst = normalized.get("total_cgst_value") or 0.0
            sgst = normalized.get("total_sgst_value") or 0.0
            igst = normalized.get("total_igst_value") or 0.0
            normalized["total_tax_amount"] = round(cgst + sgst + igst, 2)

                
        return normalized
