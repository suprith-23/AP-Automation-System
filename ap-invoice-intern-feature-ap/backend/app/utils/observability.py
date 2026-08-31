import time
import logging
from functools import wraps
from contextlib import contextmanager
from typing import Dict, Any, List
from prometheus_client import Counter, Histogram, Gauge

logger = logging.getLogger("ap.observability")

# In-memory storage for structured metrics
METRICS_REGISTRY: List[Dict[str, Any]] = []

# Define custom Prometheus metrics
OCR_DURATION = Histogram(
    "ocr_duration_seconds", "Time spent performing OCR in seconds",
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)
LLM_DURATION = Histogram(
    "llm_duration_seconds", "Time spent performing LLM extraction in seconds",
    buckets=[1.0, 2.0, 5.0, 10.0, 20.0, 45.0, 90.0]
)
INVOICE_PROCESSING_TIME = Histogram(
    "invoice_processing_time_seconds", "Total time spent processing an invoice in seconds",
    buckets=[2.0, 5.0, 10.0, 20.0, 40.0, 90.0, 180.0]
)
QUEUE_LENGTH = Gauge("queue_length", "Number of tasks waiting in the Celery queue")
CELERY_TASK_COUNT = Counter("celery_task_count_total", "Total count of Celery tasks executed")
TASK_FAILURES = Counter("task_failures_total", "Total number of failed tasks", ["task_name"])
STORAGE_OPERATIONS = Counter("storage_operations_total", "Total storage operations by type", ["operation"])

@contextmanager
def measure_execution_time(step_name: str, **kwargs):
    """
    Context manager to measure the latency of block execution.
    Logs structured metrics, updates Prometheus gauges, and appends to the registry.
    """
    start_time = time.time()
    try:
        yield
    finally:
        latency_sec = time.time() - start_time
        latency_ms = latency_sec * 1000.0
        
        metric_entry = {
            "step": step_name,
            "latency_ms": round(latency_ms, 2),
            "timestamp": time.time(),
            **kwargs
        }
        METRICS_REGISTRY.append(metric_entry)
        if len(METRICS_REGISTRY) > 10000:
            METRICS_REGISTRY.pop(0)
            
        logger.info(f"[METRIC] Step '{step_name}' completed in {latency_ms:.2f}ms | details: {kwargs}")

        # Update Prometheus metrics mapped by step_name
        if "ocr" in step_name.lower():
            OCR_DURATION.observe(latency_sec)
        elif "llm" in step_name.lower() or "extract" in step_name.lower():
            LLM_DURATION.observe(latency_sec)
        elif "pipeline" in step_name.lower():
            INVOICE_PROCESSING_TIME.observe(latency_sec)

def observe_step(step_name: str):
    """
    Decorator to measure execution time of a function/method.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                return func(*args, **kwargs)
            finally:
                latency_sec = time.time() - start_time
                latency_ms = latency_sec * 1000.0
                
                metric_entry = {
                    "step": step_name,
                    "latency_ms": round(latency_ms, 2),
                    "timestamp": time.time()
                }
                METRICS_REGISTRY.append(metric_entry)
                if len(METRICS_REGISTRY) > 10000:
                    METRICS_REGISTRY.pop(0)
                    
                logger.info(f"[METRIC] Func '{func.__name__}' ({step_name}) completed in {latency_ms:.2f}ms")

                # Update Prometheus metrics
                if "ocr" in step_name.lower():
                    OCR_DURATION.observe(latency_sec)
                elif "llm" in step_name.lower() or "extract" in step_name.lower():
                    LLM_DURATION.observe(latency_sec)
                elif "pipeline" in step_name.lower():
                    INVOICE_PROCESSING_TIME.observe(latency_sec)
        return wrapper
    return decorator
