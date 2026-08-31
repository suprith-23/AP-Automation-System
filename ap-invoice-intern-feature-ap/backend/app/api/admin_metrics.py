"""FastAPI admin metrics query routing for Super Admin observability."""
import os
import re
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies import require_super_admin, User

logger = logging.getLogger("app.api.admin_metrics")

router = APIRouter(
    prefix="/admin/metrics",
    tags=["Super Admin Metrics"],
    dependencies=[Depends(require_super_admin)]
)

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090").rstrip("/")

def inject_tenant_id(query: str, tenant_id: str) -> str:
    """Injects a tenant_id filter into all custom Prometheus metrics in the query."""
    if not tenant_id or tenant_id.lower() in ("all", "global", "anonymous"):
        return query
        
    metrics = [
        "http_request_duration_seconds",
        "celery_queue_depth",
        "celery_task_duration_seconds",
        "celery_task_failures_total",
        "db_connection_pool_active",
        "db_query_duration_seconds",
        "service_uptime",
        "api_error_rate_5xx",
        "extraction_stage_duration_seconds",
        "extraction_confidence_score",
        "extraction_failure_total",
        "llm_api_call_total",
        "llm_api_key_pool_exhaustion_total",
        "ocr_accuracy_vs_benchmark",
        "workflow_sla_breach_total",
        "workflow_approval_throughput",
        "workflow_avg_decision_time_seconds",
        "invoice_processing_error_total"
    ]
    
    modified_query = query
    for metric in metrics:
        # Match metric name optionally followed by _count, _sum, or _bucket
        if re.search(r'\b' + re.escape(metric) + r'(?:_count|_sum|_bucket)?\s*\{', modified_query):
            modified_query = re.sub(r'\b(' + re.escape(metric) + r'(?:_count|_sum|_bucket)?)\s*\{', r'\1{tenant_id="' + tenant_id + r'", ', modified_query)
        else:
            metric_pattern = r'\b(' + re.escape(metric) + r'(?:_count|_sum|_bucket)?)\b'
            modified_query = re.sub(metric_pattern, r'\1{tenant_id="' + tenant_id + r'"}', modified_query)
            
        # Cleanup potential syntax anomalies
        modified_query = modified_query.replace(", }", "}")
        modified_query = re.sub(r',\s*,', ',', modified_query)
        
    return modified_query

@router.get("/query")
async def query_prometheus(
    query: str = Query(..., description="PromQL query string"),
    tenant_id: str = Query("all", description="Scope query to specific tenant_id"),
    time: str = Query(None, description="Evaluation timestamp"),
    db: Session = Depends(get_db)
):
    """Executes a PromQL instant query against Prometheus."""
    scoped_query = inject_tenant_id(query, tenant_id)
    
    params = {"query": scoped_query}
    if time:
        params["time"] = time
        
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{PROMETHEUS_URL}/api/v1/query", params=params, timeout=10.0)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as err:
        logger.error(f"Prometheus query failure: {err}")
        raise HTTPException(status_code=502, detail=f"Failed to query Prometheus: {str(err)}")

@router.get("/query_range")
async def query_range_prometheus(
    query: str = Query(..., description="PromQL query string"),
    start: str = Query(..., description="Start timestamp"),
    end: str = Query(..., description="End timestamp"),
    step: str = Query(..., description="Query resolution step width"),
    tenant_id: str = Query("all", description="Scope query to specific tenant_id"),
    db: Session = Depends(get_db)
):
    """Executes a PromQL range query against Prometheus."""
    scoped_query = inject_tenant_id(query, tenant_id)
    
    params = {
        "query": scoped_query,
        "start": start,
        "end": end,
        "step": step
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{PROMETHEUS_URL}/api/v1/query_range", params=params, timeout=10.0)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as err:
        logger.error(f"Prometheus query range failure: {err}")
        raise HTTPException(status_code=502, detail=f"Failed to query Prometheus: {str(err)}")
