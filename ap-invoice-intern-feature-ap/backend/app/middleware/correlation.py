import uuid
import contextvars
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from celery.signals import before_task_publish, task_prerun, task_postrun

# Context variables to hold tracking IDs
correlation_id_ctx = contextvars.ContextVar("correlation_id", default=None)
request_id_ctx = contextvars.ContextVar("request_id", default=None)

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        corr_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        
        corr_token = correlation_id_ctx.set(corr_id)
        req_token = request_id_ctx.set(req_id)
        
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = corr_id
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            correlation_id_ctx.reset(corr_token)
            request_id_ctx.reset(req_token)

class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        record.correlation_id = correlation_id_ctx.get()
        record.request_id = request_id_ctx.get()
        return True

# Celery signals for context propagation
@before_task_publish.connect
def before_task_publish_handler(headers=None, body=None, **kwargs):
    if headers:
        headers["correlation_id"] = correlation_id_ctx.get()
        headers["request_id"] = request_id_ctx.get()

@task_prerun.connect
def task_prerun_handler(task_id=None, task=None, *args, **kwargs):
    # Extract from request headers
    request = task.request if task else None
    if request and hasattr(request, "headers") and request.headers:
        corr_id = request.headers.get("correlation_id")
        req_id = request.headers.get("request_id")
    else:
        corr_id = None
        req_id = None
        
    if not corr_id:
        corr_id = str(uuid.uuid4())
    if not req_id:
        req_id = str(uuid.uuid4())
        
    # Bind to task thread contextvars
    task.correlation_id_token = correlation_id_ctx.set(corr_id)
    task.request_id_token = request_id_ctx.set(req_id)

@task_postrun.connect
def task_postrun_handler(task_id=None, task=None, **kwargs):
    if task and hasattr(task, "correlation_id_token"):
        correlation_id_ctx.reset(task.correlation_id_token)
    if task and hasattr(task, "request_id_token"):
        request_id_ctx.reset(task.request_id_token)
