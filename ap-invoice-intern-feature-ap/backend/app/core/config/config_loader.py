import os
import json
import logging
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger("config.loader")

class ConfigLoader:
    """
    Lazy-loading, cached configuration loader for AP Automation.
    Reads JSON configurations from disk once and serves them from memory.
    """
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self.config_dir = Path(__file__).resolve().parent
        # Eagerly load and validate all configuration files at startup
        self.validate_configs()

    def validate_configs(self):
        # 1. State Codes
        state_codes = self.state_codes
        if not isinstance(state_codes, dict):
            raise RuntimeError("state_codes.json must be a dictionary")
        seen_states = set()
        for code, name in state_codes.items():
            if not isinstance(code, str) or not code.isdigit() or len(code) != 2:
                raise RuntimeError(f"GST state code must be a 2-digit string, got: {code}")
            if not isinstance(name, str):
                raise RuntimeError(f"GST state name must be a string, got: {name}")
            lower_name = name.lower()
            if lower_name in seen_states:
                raise RuntimeError(f"Duplicate GST state name found: {name}")
            seen_states.add(lower_name)

        # 2. Validation Rules
        val_rules = self.validation_rules
        if not isinstance(val_rules, dict):
            raise RuntimeError("validation_rules.json must be a dictionary")
        req_val_keys = {"confidence_threshold", "size_threshold_mb", "tax_math_tolerance", "vendor_name_threshold"}
        for k in req_val_keys:
            if k not in val_rules:
                raise RuntimeError(f"validation_rules.json is missing required key: {k}")
            if not isinstance(val_rules[k], (int, float)):
                raise RuntimeError(f"validation_rules.json key {k} must be a number")

        # 3. Workflow Rules
        wf_rules = self.workflow_rules
        if not isinstance(wf_rules, dict) or "transitions" not in wf_rules:
            raise RuntimeError("workflow_rules.json must contain 'transitions'")
        transitions = wf_rules["transitions"]
        if not isinstance(transitions, dict):
            raise RuntimeError("workflow_rules.json transitions must be a dictionary")
        for state, targets in transitions.items():
            if not isinstance(state, str):
                raise RuntimeError("workflow state keys must be strings")
            if not isinstance(targets, list):
                raise RuntimeError(f"workflow target states for {state} must be a list")

        # 4. Schema Config
        schema_cfg = self.schema_config
        if not isinstance(schema_cfg, dict):
            raise RuntimeError("schema_config.json must be a dictionary")
        if "alias_map" not in schema_cfg or "numeric_fields" not in schema_cfg:
            raise RuntimeError("schema_config.json must contain 'alias_map' and 'numeric_fields'")
        if not isinstance(schema_cfg["alias_map"], dict):
            raise RuntimeError("schema_config.json alias_map must be a dictionary")
        if not isinstance(schema_cfg["numeric_fields"], list):
            raise RuntimeError("schema_config.json numeric_fields must be a list")

        # 5. Compliance Rules
        comp_rules = self.compliance_rules
        if not isinstance(comp_rules, dict):
            raise RuntimeError("compliance_rules.json must be a dictionary")
        required_comp_keys = {"tds", "rcm", "hsn_sac"}
        for k in required_comp_keys:
            if k not in comp_rules:
                raise RuntimeError(f"compliance_rules.json is missing required key: {k}")

        # TDS Rules validation
        tds = comp_rules["tds"]
        if "sections" not in tds or "vendor_category_mappings" not in tds:
            raise RuntimeError("compliance_rules.json tds must contain 'sections' and 'vendor_category_mappings'")
        for sec, data in tds["sections"].items():
            required_tds_fields = {"description", "rate_with_pan", "rate_without_pan", "single_threshold", "aggregate_threshold"}
            for f in required_tds_fields:
                if f not in data:
                    raise RuntimeError(f"TDS section {sec} is missing field: {f}")
            if not isinstance(data["rate_with_pan"], (int, float)) or not isinstance(data["rate_without_pan"], (int, float)):
                raise RuntimeError(f"TDS rates for {sec} must be numeric")

        # HSN SAC rules validation
        hsn_sac = comp_rules["hsn_sac"]
        if "local_lookup" not in hsn_sac or "rcm_hsn_codes" not in hsn_sac or "blocked_itc_hsn_codes" not in hsn_sac:
            raise RuntimeError("compliance_rules.json hsn_sac must contain 'local_lookup', 'rcm_hsn_codes', and 'blocked_itc_hsn_codes'")
        for hsn, data in hsn_sac["local_lookup"].items():
            if not isinstance(hsn, str) or not hsn.isdigit() or len(hsn) < 4 or len(hsn) > 8:
                raise RuntimeError(f"Invalid HSN code format: {hsn}")
            if "description" not in data or "gst_rate" not in data:
                raise RuntimeError(f"HSN {hsn} local lookup must contain 'description' and 'gst_rate'")
            if not isinstance(data["gst_rate"], (int, float)):
                raise RuntimeError(f"HSN {hsn} gst_rate must be numeric")

        # 6. Validate New JSON Rules
        if not isinstance(self.tds_rules, dict) or "rules" not in self.tds_rules:
             raise RuntimeError("tds_rules.json must contain 'rules' list")
        if not isinstance(self.gst_rules, dict):
             raise RuntimeError("gst_rules.json must be a dictionary")
        if not isinstance(self.rcm_rules, dict) or "rules" not in self.rcm_rules:
             raise RuntimeError("rcm_rules.json must contain 'rules' list")
        if not isinstance(self.irn_rules, dict):
             raise RuntimeError("irn_rules.json must be a dictionary")
        if not isinstance(self.approval_matrix, dict) or "rules" not in self.approval_matrix:
             raise RuntimeError("approval_matrix.json must contain 'rules' list")
        if not isinstance(self.sla_rules, dict) or "stages" not in self.sla_rules:
             raise RuntimeError("sla_rules.json must contain 'stages'")
        if not isinstance(self.analytics_config, dict):
             raise RuntimeError("analytics_config.json must be a dictionary")

    def _load(self, filename: str) -> Any:
        if filename in self._cache:
            return self._cache[filename]
        
        filepath = self.config_dir / filename
        if not filepath.exists():
            logger.warning(f"Configuration file {filename} not found in {self.config_dir}.")
            self._cache[filename] = {}
            return self._cache[filename]
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                self._cache[filename] = json.load(f)
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing {filename}: {e}")
            self._cache[filename] = {}
        except Exception as e:
            logger.error(f"Error loading {filename}: {e}")
            self._cache[filename] = {}
            
        return self._cache[filename]

    @property
    def compliance_rules(self) -> Dict[str, Any]:
        return self._load("compliance_rules.json")

    @property
    def state_codes(self) -> Dict[str, str]:
        return self._load("state_codes.json")

    @property
    def validation_rules(self) -> Dict[str, Any]:
        return self._load("validation_rules.json")

    @property
    def workflow_rules(self) -> Dict[str, Any]:
        return self._load("workflow_rules.json")

    @property
    def schema_config(self) -> Dict[str, Any]:
        return self._load("schema_config.json")

    @property
    def tds_rules(self) -> Dict[str, Any]:
        return self._load("tds_rules.json")

    @property
    def gst_rules(self) -> Dict[str, Any]:
        return self._load("gst_rules.json")

    @property
    def rcm_rules(self) -> Dict[str, Any]:
        return self._load("rcm_rules.json")

    @property
    def irn_rules(self) -> Dict[str, Any]:
        return self._load("irn_rules.json")

    @property
    def approval_matrix(self) -> Dict[str, Any]:
        return self._load("approval_matrix.json")

    @property
    def sla_rules(self) -> Dict[str, Any]:
        return self._load("sla_rules.json")

    @property
    def analytics_config(self) -> Dict[str, Any]:
        return self._load("analytics_config.json")

# Singleton instance
CONFIG = ConfigLoader()
