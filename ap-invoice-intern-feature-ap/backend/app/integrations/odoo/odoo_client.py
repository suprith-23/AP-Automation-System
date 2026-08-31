import os
import time
import logging
import xmlrpc.client
from typing import Any, List, Dict, Optional

logger = logging.getLogger("odoo.client")

class OdooClient:
    def __init__(
        self,
        url: Optional[str] = None,
        db: Optional[str] = None,
        username: Optional[str] = None,
        api_key: Optional[str] = None,
        max_retries: int = 3,
        backoff_factor: float = 2.0
    ):
        self.url = url or os.getenv("ODOO_URL", "http://localhost:8069")
        self.db = db or os.getenv("ODOO_DB", "odoo_db")
        self.username = username or os.getenv("ODOO_USER", "admin@company.com")
        self.api_key = api_key or os.getenv("ODOO_API_KEY", "")
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.uid: Optional[int] = None

        # Clean/normalize URL
        if self.url.endswith("/"):
            self.url = self.url[:-1]

    def _redact_key(self, data: Any) -> Any:
        """Redact API key from logging output."""
        if isinstance(data, str) and self.api_key and self.api_key in data:
            return data.replace(self.api_key, "********")
        if isinstance(data, dict):
            return {k: self._redact_key(v) for k, v in data.items()}
        if isinstance(data, list):
            return [self._redact_key(x) for x in data]
        return data

    def authenticate(self) -> int:
        """Authenticate with the Odoo instance and cache the UID."""
        if self.uid is not None:
            return self.uid

        common_url = f"{self.url}/xmlrpc/2/common"
        logger.info(f"Authenticating with Odoo common endpoint: {common_url}")

        for attempt in range(self.max_retries):
            try:
                common = xmlrpc.client.ServerProxy(common_url, allow_none=True)
                uid = common.authenticate(self.db, self.username, self.api_key, {})
                if not uid:
                    raise PermissionError("Odoo authentication failed: Invalid credentials or database name.")
                self.uid = int(uid)
                logger.info(f"Odoo authentication successful. UID: {self.uid}")
                return self.uid
            except (xmlrpc.client.ProtocolError, ConnectionError, OSError) as e:
                if isinstance(e, PermissionError):
                    raise e
                wait_time = self.backoff_factor ** attempt
                logger.warning(
                    f"Odoo connection attempt {attempt + 1} failed. Retrying in {wait_time}s. Error: {self._redact_key(str(e))}"
                )
                time.sleep(wait_time)
        raise ConnectionError("Failed to authenticate with Odoo after max retries.")


    def execute(self, model: str, method: str, *args, **kwargs) -> Any:
        """Execute a method on an Odoo model via execute_kw."""
        uid = self.authenticate()
        object_url = f"{self.url}/xmlrpc/2/object"
        
        redacted_args = self._redact_key(list(args))
        redacted_kwargs = self._redact_key(kwargs)
        logger.debug(f"Odoo Exec: {model}.{method} args={redacted_args} kwargs={redacted_kwargs}")

        for attempt in range(self.max_retries):
            try:
                db_proxy = xmlrpc.client.ServerProxy(object_url, allow_none=True)
                result = db_proxy.execute_kw(
                    self.db,
                    uid,
                    self.api_key,
                    model,
                    method,
                    args,
                    kwargs
                )
                logger.debug(f"Odoo Exec success: {model}.{method}")
                return result
            except xmlrpc.client.Fault as e:
                # Odoo application faults shouldn't be retried
                logger.error(f"Odoo XML-RPC Fault: Code {e.faultCode} - {e.faultString}")
                raise e
            except (xmlrpc.client.ProtocolError, ConnectionError, OSError) as e:
                wait_time = self.backoff_factor ** attempt
                logger.warning(
                    f"Odoo execute_kw connection attempt {attempt + 1} failed. Retrying in {wait_time}s. Error: {self._redact_key(str(e))}"
                )
                time.sleep(wait_time)
        raise ConnectionError(f"Failed to execute {model}.{method} after max retries.")
