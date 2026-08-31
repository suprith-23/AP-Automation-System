"""Configuration parser for the Purchase Order Matching Engine."""
import os
import json

class MatchingConfig:
    def __init__(self, config_path: str = None):
        if not config_path:
            config_path = os.path.join(os.path.dirname(__file__), "matching_config.json")
            
        self.config_data = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    self.config_data = json.load(f)
            except Exception:
                pass
                
        # Tolerances & Thresholds with Env overrides
        try:
            self.amount_tolerance = float(os.getenv("PO_AMOUNT_TOLERANCE", str(self.config_data.get("amount_tolerance", 0.02))))
        except ValueError:
            self.amount_tolerance = 0.02
            
        try:
            from app.core.config import CONFIG
            self.vendor_name_threshold = float(os.getenv("PO_VENDOR_NAME_MATCH_THRESHOLD", str(self.config_data.get("vendor_name_threshold", CONFIG.validation_rules.get("vendor_name_threshold", 0.85)))))
        except ValueError:
            self.vendor_name_threshold = 0.85
            
        self.default_currency = os.getenv("PO_DEFAULT_CURRENCY", self.config_data.get("default_currency", "INR"))
        
        try:
            self.min_match_score = float(os.getenv("PO_MIN_MATCH_SCORE", str(self.config_data.get("min_match_score", 80.0))))
        except ValueError:
            self.min_match_score = 80.0
