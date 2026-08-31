"""Global FastAPI exception handler middleware."""
import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, IntegrityError
from pydantic import ValidationError

logger = logging.getLogger("ap_automation.exception_handler")

async def global_exception_handler(request: Request, exc: Exception):
    """
    Standardizes error responses across all backend API endpoints.
    """
    if isinstance(exc, ValidationError):
        logger.error(f"Validation schema error: {str(exc)}")
        return JSONResponse(
            status_code=422,
            content={"detail": "Request schema validation failed", "errors": exc.errors()}
        )

    if isinstance(exc, OperationalError):
        logger.critical(f"Database connection error: {str(exc)}")
        return JSONResponse(
            status_code=503,
            content={"detail": "Database unavailable. Please try again later."}
        )

    if isinstance(exc, IntegrityError):
        logger.error(f"Database integrity/duplicate constraint error: {str(exc)}")
        return JSONResponse(
            status_code=400,
            content={"detail": "Database constraint violation (possible duplicate invoice number or missing references)."}
        )

    logger.exception(f"Unhandled system exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"An unexpected system error occurred: {str(exc)}"}
    )
