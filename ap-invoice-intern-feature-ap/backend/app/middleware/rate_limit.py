import time
import logging
import os
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import redis

logger = logging.getLogger("ap_automation.rate_limit")

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Centralized rate limiting middleware targeting document ingestion endpoints.
    Limits upload actions to 10 requests per minute per IP address.
    Uses Redis as a central cache when available, with a local in-memory fallback.
    """
    def __init__(self, app, limit: int = 10, window_secs: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window_secs = window_secs
        # Local fallback map of IP -> list of timestamps
        self.request_history = defaultdict(list)
        # Target endpoints to rate-limit (ingestion endpoints)
        self.target_paths = {"/api/v1/ai/extract", "/api/v1/extract-invoice", "/api/v1/invoices/", "/api/v1/documents/upload"}
        self.redis_client = None
        self._init_redis()

    def _init_redis(self):
        try:
            redis_host = os.getenv("REDIS_HOST", "postgres") # fallback or docker service
            if redis_host == "postgres": # default is postgres for DB, let's use redis or localhost
                redis_host = "redis" if os.path.exists("/.dockerenv") else "localhost"
            self.redis_client = redis.Redis(host=redis_host, port=6379, db=0, socket_timeout=0.5)
            self.redis_client.ping()
            logger.info(f"RateLimiter successfully connected to centralized Redis at {redis_host}:6379")
        except Exception as e:
            self.redis_client = None
            logger.warning(f"Centralized Redis not available for rate limiting. Falling back to local in-memory storage. Detail: {e}")

    async def dispatch(self, request: Request, call_next) -> Response:
        if os.getenv("TESTING") == "True":
            return await call_next(request)

        # Rate limit POST requests targeting document ingestion paths or login
        is_login = (request.url.path == "/auth/login" or request.url.path == "/api/v1/auth/login") and request.method == "POST"
        is_ingestion = any(request.url.path.startswith(path) for path in self.target_paths) and request.method == "POST"
        
        if is_login or is_ingestion:
            limit = 20 if is_login else self.limit
            limit_msg = "Login rate limit exceeded. Please wait a moment." if is_login else "Upload rate limit exceeded"
            client_ip = request.client.host if request.client else "unknown"
            current_time = time.time()
            
            use_memory_fallback = True
            
            if self.redis_client:
                try:
                    prefix = "rate_limit_login" if is_login else "rate_limit"
                    key = f"{prefix}:{client_ip}"
                    pipe = self.redis_client.pipeline()
                    # Clean up expired members
                    pipe.zremrangebyscore(key, 0, current_time - self.window_secs)
                    # Count elements
                    pipe.zcard(key)
                    # Add current element
                    pipe.zadd(key, {str(current_time): current_time})
                    pipe.expire(key, self.window_secs)
                    
                    res = pipe.execute()
                    current_count = res[1]
                    
                    if current_count >= limit:
                        logger.warning(f"Rate limit exceeded for client {client_ip} on path {request.url.path} (Redis)")
                        return JSONResponse(
                            status_code=429,
                            content={"detail": f"Too many requests. {limit_msg}. Please try again later."}
                        )
                    use_memory_fallback = False
                except Exception as e:
                    logger.error(f"Redis rate limiting failed, falling back to local memory: {e}")
                    use_memory_fallback = True
            
            if use_memory_fallback:
                history_key = f"login:{client_ip}" if is_login else client_ip
                # Remove timestamps outside the sliding rate-limit window
                cutoff = current_time - self.window_secs
                self.request_history[history_key] = [t for t in self.request_history[history_key] if t > cutoff]
                
                if len(self.request_history[history_key]) >= limit:
                    logger.warning(f"Rate limit exceeded for client {client_ip} on path {request.url.path} (In-Memory)")
                    return JSONResponse(
                        status_code=429,
                        content={"detail": f"Too many requests. {limit_msg}. Please try again later."}
                    )
                
                # Record current request timestamp
                self.request_history[history_key].append(current_time)
            
        return await call_next(request)
