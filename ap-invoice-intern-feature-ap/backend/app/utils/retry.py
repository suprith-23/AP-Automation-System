import os
import time
import asyncio
import logging
from functools import wraps
import httpx
from app.utils.secrets import secrets

logger = logging.getLogger("ap_automation.retry")


def _describe_exception(exc: Exception) -> str:
    """Render exceptions with enough context to debug transient API failures."""
    parts = [exc.__class__.__name__]

    message = str(exc).strip()
    if message:
        parts.append(message)

    request = getattr(exc, "request", None)
    if request is not None:
        parts.append(f"{request.method} {request.url}")

    response = getattr(exc, "response", None)
    if response is not None:
        parts.append(f"status={response.status_code}")
        try:
            body = response.text.strip()
        except Exception:
            body = ""
        if body:
            compact_body = " ".join(body.split())
            parts.append(f"body={compact_body[:300]}")

    return " | ".join(parts)

def retry_async(retries: int = None, delay: float = None, backoff: float = None, exceptions=(httpx.HTTPError, Exception), retry_on_429: bool = True):
    """
    Decorator to retry asynchronous functions using exponential backoff.
    Specifies special early-exit exceptions for non-transient HTTP status errors.
    """
    if retries is None:
        retries = int(secrets.get_secret("MAX_RETRIES", "3"))
    if delay is None:
        delay = float(secrets.get_secret("RETRY_DELAY", "1.0"))
    if backoff is None:
        backoff = float(secrets.get_secret("BACKOFF_FACTOR", "2.0"))

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            m_delay = delay
            for attempt in range(1, retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    # If it's a status error, fail fast for bad requests, unauthorized, etc., except rate limits
                    current_delay = m_delay
                    if isinstance(e, httpx.HTTPStatusError):
                        status_code = e.response.status_code
                        if status_code >= 400 and status_code < 500 and status_code != 429:
                            logger.error(
                                "Non-transient HTTP error %s. Aborting retries. %s",
                                status_code,
                                _describe_exception(e),
                            )
                            raise e
                        
                        if status_code == 429:
                            if not retry_on_429:
                                logger.error(
                                    "Rate limit HTTP error 429. retry_on_429 is False. Aborting retries. %s",
                                    _describe_exception(e),
                                )
                                raise e
                            # Parse retry-after from headers or reset times
                            retry_after_str = e.response.headers.get("retry-after")
                            rate_reset_str = e.response.headers.get("x-ratelimit-reset") or e.response.headers.get("x-rate-limit-reset")
                            
                            custom_wait = None
                            if retry_after_str:
                                try:
                                    custom_wait = float(retry_after_str)
                                except ValueError:
                                    pass
                            elif rate_reset_str:
                                try:
                                    import re
                                    match = re.search(r'([\d.]+)', rate_reset_str)
                                    if match:
                                        custom_wait = float(match.group(1))
                                except ValueError:
                                    pass
                                    
                            if custom_wait is not None:
                                current_delay = custom_wait + 0.5
                                logger.warning(
                                    "Rate limit 429 hit. Extracted wait time from headers: %.2fs",
                                    current_delay
                                )
                            else:
                                try:
                                    body = e.response.text
                                    import re
                                    match = re.search(r'(?:try again in|retry after|rate limit reached for|lease try again in|lease wait)\s+([\d.]+)\s*s', body, re.IGNORECASE)
                                    if match:
                                        current_delay = float(match.group(1)) + 0.5
                                        logger.warning(
                                            "Rate limit 429 hit. Extracted wait time from body: %.2fs",
                                            current_delay
                                        )
                                    else:
                                        current_delay = 20.0
                                        logger.warning(
                                            "Rate limit 429 hit. No wait time found, defaulting to %.2fs",
                                            current_delay
                                        )
                                except Exception:
                                    current_delay = 20.0
                                    logger.warning(
                                        "Rate limit 429 hit. Error checking body, defaulting to %.2fs",
                                        current_delay
                                    )
                            
                            if os.getenv("TESTING") == "true":
                                logger.info("TESTING=true detected: capping retry delay to 0.5s")
                                current_delay = 0.5
                    
                    if attempt == retries:
                        logger.error(
                            "Failed after %s attempts. Final error: %s",
                            retries,
                            _describe_exception(e),
                        )
                        raise e
                    
                    logger.warning(
                        "Attempt %s failed: %s. Retrying in %.2f seconds...",
                        attempt,
                        _describe_exception(e),
                        current_delay,
                    )
                    await asyncio.sleep(current_delay)
                    m_delay *= backoff
            return await func(*args, **kwargs)
        return wrapper
    return decorator
