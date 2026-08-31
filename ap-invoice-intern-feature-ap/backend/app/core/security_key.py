"""
Fernet symmetric encryption helper for API keys stored in database.
Uses SECRET_KEY from application environment.
"""

import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def _get_fernet_instance() -> Fernet:
    secret = os.getenv("SECRET_KEY", "default-ap-automation-secret-key-change-in-production")
    salt = b"ap_automation_salt_fixed"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
    return Fernet(key)


def encrypt_api_key(raw_key: str) -> str:
    """Encrypt a plaintext API key string."""
    if not raw_key:
        return ""
    if raw_key.startswith("enc_"):
        return raw_key  # Already encrypted
    f = _get_fernet_instance()
    enc_bytes = f.encrypt(raw_key.encode())
    return "enc_" + enc_bytes.decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an encrypted API key string."""
    if not encrypted_key:
        return ""
    if not encrypted_key.startswith("enc_"):
        return encrypted_key  # Plaintext key fallback
    try:
        f = _get_fernet_instance()
        raw_bytes = encrypted_key[4:].encode()
        return f.decrypt(raw_bytes).decode()
    except Exception:
        return ""
