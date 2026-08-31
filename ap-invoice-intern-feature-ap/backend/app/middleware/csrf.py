import secrets
import os
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        is_testing = os.environ.get("TESTING") == "True"
        is_dev_bypass = (
            os.environ.get("APP_ENV", "development").lower() in ("development", "dev")
            and os.environ.get("ALLOW_CSRF_BYPASS", "false").lower() == "true"
        )
        if is_testing or is_dev_bypass:
            return await call_next(request)
        # Only enforce CSRF on state-changing requests
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            path = request.url.path
            exempt_paths = [
                "/api/v1/auth/login",
                "/auth/login",
                "/api/v1/auth/register",
                "/auth/register",
                "/api/v1/auth/forgot-password",
                "/auth/forgot-password",
                "/api/v1/auth/reset-password",
                "/auth/reset-password",
                "/api/v1/auth/logout",
                "/auth/logout",
                "/api/v1/auth/refresh",
                "/auth/refresh",
            ]
            
            if not any(path.startswith(p) for p in exempt_paths):
                # Bypass CSRF checks if Bearer token is used instead of cookies
                auth_header = request.headers.get("authorization")
                has_bearer = auth_header and auth_header.strip().lower().startswith("bearer ")
                has_session_cookie = "access_token" in request.cookies or "csrf_token" in request.cookies

                if has_bearer and not has_session_cookie:
                    return await call_next(request)

                csrf_cookie = request.cookies.get("csrf_token")
                csrf_header = request.headers.get("x-csrf-token")
                
                if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "CSRF token validation failed"}
                    )
                    
        return await call_next(request)

