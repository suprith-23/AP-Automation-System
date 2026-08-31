import logging
from typing import Dict, Any

from app.ai.extraction.stage1_cleaning import Stage1Cleaner
from app.ai.extraction.stage2_deterministic import Stage2Deterministic
from app.ai.extraction.stage3_layout import Stage3Layout
from app.ai.extraction.stage4_table import Stage4Table
from app.ai.extraction.stage5_grouping import Stage5Grouping
from app.ai.extraction.stage6_confidence import Stage6Confidence
from app.ai.extraction.stage7_compression import Stage7Compression
from app.ai.extraction.stage8_llm import Stage8LLM
from app.ai.extraction.stage8b_conflict import Stage8bConflictResolution
from app.ai.extraction.schema_normalization import SchemaNormalization
from app.ai.extraction.stage9_validation import Stage9Validation
from app.ai.ocr.models import OCRResult

logger = logging.getLogger("ap_automation.extraction_pipeline")

class ExtractionPipeline:
    """
    Orchestrates the multi-stage invoice extraction pipeline.
    """

    @staticmethod
    async def process(ocr_result: OCRResult, prompt_version: str = None, tenant_id: str = "global") -> Dict[str, Any]:
        """
        Executes the full pipeline from raw OCR Result to validated invoice JSON.
        """
        import time
        from app.core.metrics import EXTRACTION_STAGE_DURATION, EXTRACTION_CONFIDENCE_SCORE, EXTRACTION_FAILURE
        
        t_start = time.perf_counter()
        logger.info("Stage 1: Cleaning OCR Text")
        cleaned_text, clean_blocks = Stage1Cleaner.clean_text(ocr_result.text, ocr_result.blocks)
        EXTRACTION_STAGE_DURATION.labels(stage="1", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 2: Deterministic Extraction")
        deterministic_fields = Stage2Deterministic.extract_all(cleaned_text, clean_blocks)
        EXTRACTION_STAGE_DURATION.labels(stage="2", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 3: Layout Analysis")
        layout_blocks = Stage3Layout.partition_text(cleaned_text, clean_blocks)
        EXTRACTION_STAGE_DURATION.labels(stage="3", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 4: Table Detection")
        table_rows = Stage4Table.extract_table(layout_blocks.get("line_items", ""), clean_blocks)
        EXTRACTION_STAGE_DURATION.labels(stage="4", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 5: Field Grouping")
        grouped_data = Stage5Grouping.group_fields(
            deterministic_fields=deterministic_fields,
            layout_blocks=layout_blocks,
            table_rows=table_rows,
            clean_blocks=clean_blocks
        )
        EXTRACTION_STAGE_DURATION.labels(stage="5", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 6: Confidence Scoring")
        refined_data = Stage6Confidence.refine_confidence(grouped_data)
        EXTRACTION_STAGE_DURATION.labels(stage="6", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 7: Token Compression")
        compressed_json = Stage7Compression.compress_for_llm(refined_data)
        EXTRACTION_STAGE_DURATION.labels(stage="7", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 8: LLM Semantic Tasks")
        try:
            # Ensure your prompt in invoice_extraction_v2.txt expects the new format
            llm_output = await Stage8LLM.extract_semantic_data(compressed_json, prompt_version=prompt_version)
        except Exception as e:
            # Determine reason for extraction failure
            reason = "timeout"
            err_str = str(e).lower()
            if "401" in err_str or "unauthorized" in err_str:
                reason = "api_401"
            elif "429" in err_str or "rate limit" in err_str:
                reason = "rate_limit"
            elif "hallucination" in err_str:
                reason = "hallucination"
            EXTRACTION_FAILURE.labels(reason=reason, tenant_id=tenant_id).inc()
            raise e
            
        EXTRACTION_STAGE_DURATION.labels(stage="8", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 9a: Schema Normalization")
        invoice_data = llm_output.get("invoice_data", {})
        invoice_data = SchemaNormalization.normalize(invoice_data)
        llm_output["invoice_data"] = invoice_data
        EXTRACTION_STAGE_DURATION.labels(stage="9a", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 8b: Conflict Resolution")
        resolved_data = Stage8bConflictResolution.resolve(llm_output, grouped_data)
        invoice_data = resolved_data.get("invoice_data", {})
        extraction_metadata = resolved_data.get("extraction_metadata", {})
        confidence_data = llm_output.get("confidence", {})
        
        prompt_version_used = llm_output.get("prompt_version", "unknown")
        extraction_metadata["prompt_version"] = prompt_version_used
        EXTRACTION_STAGE_DURATION.labels(stage="8b", tenant_id=tenant_id).observe(time.perf_counter() - t_start)
        
        t_start = time.perf_counter()
        logger.info("Stage 9b: Validation")
        validation_errors = Stage9Validation.validate_invoice(invoice_data)        
        EXTRACTION_STAGE_DURATION.labels(stage="9b", tenant_id=tenant_id).observe(time.perf_counter() - t_start)

        # Record LLM extraction confidence scores per provider (if available in prompt version string or model config)
        # Determine provider name from prompt_version_used or metadata
        provider_name = "unknown"
        if "gemini" in prompt_version_used.lower():
            provider_name = "gemini"
        elif "groq" in prompt_version_used.lower():
            provider_name = "groq"
        elif "nvidia" in prompt_version_used.lower():
            provider_name = "nvidia"
            
        # Calculate avg confidence
        conf_scores = [v for v in confidence_data.values() if isinstance(v, (int, float))]
        avg_confidence = sum(conf_scores) / len(conf_scores) if conf_scores else 1.0
        EXTRACTION_CONFIDENCE_SCORE.labels(provider=provider_name, tenant_id=tenant_id).observe(avg_confidence)

        return {
            "invoice_data": invoice_data,
            "confidence": confidence_data,
            "extraction_metadata": extraction_metadata,
            "validation_errors": validation_errors,
            "prompt_version": prompt_version_used,
            "debug_compressed_tokens": len(compressed_json) // 4  # rough token estimate
        }

