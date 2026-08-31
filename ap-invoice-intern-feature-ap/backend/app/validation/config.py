"""Configuration loader for the AP Validation Engine."""
import os
import json
from typing import List

class ValidationConfig:
    def __init__(self, config_path: str = None):
        if not config_path:
            config_path = os.path.join(os.path.dirname(__file__), "validation_config.json")
            
        self.config_data = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    self.config_data = json.load(f)
            except Exception:
                pass
                
        # Load configurable keys
        self.required_fields = self.config_data.get("required_fields", ["invoice_number", "invoice_date", "total_invoice_value", "seller_name", "buyer_name", "currency"])
        self.gstin_regex = self.config_data.get("gstin_regex", "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
        self.valid_state_codes = self.config_data.get("valid_state_codes", [
            "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
            "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
            "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
            "33", "34", "35", "36", "37", "38", "97", "99"
        ])
        
        # Override with Environment Variables if defined
        try:
            self.tolerance_limit = float(os.getenv("TAX_TOLERANCE_LIMIT", str(self.config_data.get("tolerance_limit", 1.0))))
        except ValueError:
            self.tolerance_limit = 1.0
            
        try:
            from app.core.config import CONFIG
            self.confidence_threshold = float(os.getenv("CONFIDENCE_THRESHOLD", str(self.config_data.get("confidence_threshold", CONFIG.validation_rules.get("confidence_threshold", 0.8)))))
        except ValueError:
            self.confidence_threshold = 0.8
            
        self.allowed_currencies = self.config_data.get("allowed_currencies", ["INR", "USD", "EUR", "GBP"])
        self.future_date_allowed = os.getenv("FUTURE_DATE_ALLOWED", "").lower() in ("true", "1") or self.config_data.get("future_date_allowed", False)
        self.duplicate_check_enabled = os.getenv("DUPLICATE_CHECK_ENABLED", "").lower() in ("true", "1") or self.config_data.get("duplicate_check_enabled", True)
