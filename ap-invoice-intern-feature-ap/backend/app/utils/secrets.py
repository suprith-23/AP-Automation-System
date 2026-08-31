import os
from abc import ABC, abstractmethod
import logging

logger = logging.getLogger("ap.secrets")

class SecretProvider(ABC):
    @abstractmethod
    def get_secret(self, key: str, default: str = None) -> str:
        """Retrieve the secret value for the specified key."""
        pass

class EnvSecretProvider(SecretProvider):
    def get_secret(self, key: str, default: str = None) -> str:
        return os.getenv(key, default)

class VaultSecretProvider(SecretProvider):
    def __init__(self):
        logger.warning("VaultSecretProvider is a placeholder only. Falling back to environment variables.")
        self.fallback = EnvSecretProvider()

    def get_secret(self, key: str, default: str = None) -> str:
        # Placeholder fallback
        return self.fallback.get_secret(key, default)

class AWSSecretsProvider(SecretProvider):
    def __init__(self):
        logger.warning("AWSSecretsProvider is a placeholder only. Falling back to environment variables.")
        self.fallback = EnvSecretProvider()

    def get_secret(self, key: str, default: str = None) -> str:
        # Placeholder fallback
        return self.fallback.get_secret(key, default)

def get_secret_provider() -> SecretProvider:
    provider_type = os.getenv("SECRET_PROVIDER", "env").lower()
    if provider_type == "vault":
        return VaultSecretProvider()
    elif provider_type == "aws":
        return AWSSecretsProvider()
    else:
        return EnvSecretProvider()

secrets = get_secret_provider()
