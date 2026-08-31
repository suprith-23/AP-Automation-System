"""Middleware to track HTTP request metrics in Prometheus."""
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.metrics import HTTP_REQUEST_DURATION, API_ERROR_RATE_5XX
from app.core.security.jwt import decode_token

class PrometheusMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Resolve tenant ID from JWT
        tenant_id = "anonymous"
        token = request.headers.get("Authorization")
        if token and token.startswith("Bearer "):
            token = token[7:]
        else:
            token = request.cookies.get("access_token")
            
        if token:
            payload = decode_token(token)
            if payload:
                tenant_id = payload.get("organization_id", "global")
                
        response = await call_next(request)
        
        duration = time.time() - start_time
        status_code = str(response.status_code)
        
        # Track HTTP duration
        # Clean path for Prometheus (collapse path parameters like IDs)
        # e.g., /api/v1/dashboard/invoice/123 -> /api/v1/dashboard/invoice/{id}
        path = request.url.path
        import re
        normalized_path = re.sub(r'/[a-f0-9\-]{36}', '/{uuid}', path)
        normalized_path = re.sub(r'/\d+', '/{id}', normalized_path)
        
        HTTP_REQUEST_DURATION.labels(
            endpoint=normalized_path,
            method=request.method,
            status_code=status_code,
            tenant_id=tenant_id
        ).observe(duration)
        
        # Track 5xx errors
        if response.status_code >= 500:
            API_ERROR_RATE_5XX.labels(tenant_id=tenant_id).inc()
            
        return response
