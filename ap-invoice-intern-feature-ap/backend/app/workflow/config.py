"""Configuration parser for the Workflow and Approval Engine."""
import os
import json

class WorkflowConfig:
    def __init__(self, config_path: str = None):
        if not config_path:
            config_path = os.path.join(os.path.dirname(__file__), "workflow_config.json")
            
        self.config_data = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    self.config_data = json.load(f)
            except Exception:
                pass
                
        # Load configurable keys with standard overrides
        try:
            self.min_validation_score = float(os.getenv("MIN_VALIDATION_SCORE", str(self.config_data.get("min_validation_score", 90.0))))
        except ValueError:
            self.min_validation_score = 90.0
            
        try:
            self.min_match_score = float(os.getenv("MIN_MATCH_SCORE", str(self.config_data.get("min_match_score", 90.0))))
        except ValueError:
            self.min_match_score = 90.0
            
        try:
            self.min_extraction_confidence = float(os.getenv("MIN_EXTRACTION_CONFIDENCE", str(self.config_data.get("min_extraction_confidence", 0.85))))
        except ValueError:
            self.min_extraction_confidence = 0.85
