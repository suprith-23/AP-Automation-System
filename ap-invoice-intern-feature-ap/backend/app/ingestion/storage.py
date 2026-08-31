"""File storage providers abstraction layer."""
from abc import ABC, abstractmethod
import os
import uuid
import logging

logger = logging.getLogger("ingestion.storage")

class StorageProvider(ABC):
    @abstractmethod
    def save(self, file_bytes: bytes, filename: str) -> str:
        """Saves file bytes and returns storage key path."""
        pass
        
    @abstractmethod
    def get(self, storage_path: str) -> bytes:
        """Retrieves raw bytes from storage."""
        pass
        
    @abstractmethod
    def delete(self, storage_path: str) -> None:
        """Deletes file from storage."""
        pass

class LocalStorageProvider(StorageProvider):
    def __init__(self, base_dir: str = None):
        if not base_dir:
            base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "storage_files")
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)
        
    def save(self, file_bytes: bytes, filename: str) -> str:
        ext = os.path.splitext(filename)[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(self.base_dir, unique_name)
        with open(filepath, "wb") as f:
            f.write(file_bytes)
        return filepath
        
    def get(self, storage_path: str) -> bytes:
        with open(storage_path, "rb") as f:
            return f.read()
            
    def delete(self, storage_path: str) -> None:
        if os.path.exists(storage_path):
            os.remove(storage_path)

class S3StorageProvider(StorageProvider):
    """
    AWS S3 / GCS cloud-native storage provider.
    Falls back to LocalStorageProvider if boto3 is not installed or AWS keys are missing.
    """
    def __init__(self, bucket_name: str = None):
        self.bucket_name = bucket_name or os.getenv("AWS_S3_BUCKET", "ap-automation-invoices")
        self.aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.local_fallback = LocalStorageProvider()
        self.use_local = True

        if self.aws_access_key and self.aws_secret_key:
            try:
                import boto3
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=self.aws_access_key,
                    aws_secret_access_key=self.aws_secret_key
                )
                self.use_local = False
                logger.info(f"S3StorageProvider initialized successfully using bucket {self.bucket_name}")
            except ImportError:
                logger.warning("boto3 package not installed. Falling back to local storage persistence.")
            except Exception as e:
                logger.error(f"Failed to connect to AWS S3, falling back to local: {e}")

    def save(self, file_bytes: bytes, filename: str) -> str:
        if self.use_local:
            return self.local_fallback.save(file_bytes, filename)
        
        ext = os.path.splitext(filename)[1]
        unique_name = f"invoices/{uuid.uuid4()}{ext}"
        try:
            from io import BytesIO
            self.s3_client.upload_fileobj(BytesIO(file_bytes), self.bucket_name, unique_name)
            return f"s3://{self.bucket_name}/{unique_name}"
        except Exception as e:
            logger.error(f"S3 upload failed: {e}. Falling back to local save.")
            return self.local_fallback.save(file_bytes, filename)

    def get(self, storage_path: str) -> bytes:
        if self.use_local or not storage_path.startswith("s3://"):
            return self.local_fallback.get(storage_path)
            
        try:
            path_parts = storage_path.replace("s3://", "").split("/", 1)
            bucket = path_parts[0]
            key = path_parts[1]
            from io import BytesIO
            out = BytesIO()
            self.s3_client.download_fileobj(bucket, key, out)
            return out.getvalue()
        except Exception as e:
            logger.error(f"S3 download failed: {e}. Attempting local fallback.")
            return self.local_fallback.get(storage_path)

    def delete(self, storage_path: str) -> None:
        if self.use_local or not storage_path.startswith("s3://"):
            return self.local_fallback.delete(storage_path)
            
        try:
            path_parts = storage_path.replace("s3://", "").split("/", 1)
            bucket = path_parts[0]
            key = path_parts[1]
            self.s3_client.delete_object(Bucket=bucket, Key=key)
        except Exception as e:
            logger.error(f"S3 delete failed: {e}")

class MinIOStorageProvider(S3StorageProvider):
    """
    MinIO S3-compatible cloud storage provider.
    Reuses S3 client logic but routes requests to a local MinIO endpoint URL.
    """
    def __init__(self, bucket_name: str = None):
        self.bucket_name = bucket_name or os.getenv("MINIO_BUCKET_NAME", "ap-automation-invoices")
        self.aws_access_key = (
            os.getenv("MINIO_ACCESS_KEY")
            or os.getenv("AWS_ACCESS_KEY_ID")
            or os.getenv("MINIO_ROOT_USER")
            or "minioadmin"
        )
        self.aws_secret_key = (
            os.getenv("MINIO_SECRET_KEY")
            or os.getenv("AWS_SECRET_ACCESS_KEY")
            or os.getenv("MINIO_ROOT_PASSWORD")
            or "minioadmin"
        )
        self.endpoint_url = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
        self.local_fallback = LocalStorageProvider()
        self.use_local = True

        if self.aws_access_key and self.aws_secret_key:
            try:
                import boto3
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=self.aws_access_key,
                    aws_secret_access_key=self.aws_secret_key,
                    endpoint_url=self.endpoint_url
                )
                # Auto-create bucket if it doesn't exist
                try:
                    self.s3_client.head_bucket(Bucket=self.bucket_name)
                    logger.info(f"MinIO bucket '{self.bucket_name}' already exists.")
                except Exception:
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                    logger.info(f"MinIO bucket '{self.bucket_name}' created successfully.")
                self.use_local = False
                logger.info(f"MinIOStorageProvider initialized successfully using bucket {self.bucket_name} at {self.endpoint_url}")
            except ImportError:
                logger.warning("boto3 package not installed. Falling back to local storage persistence.")
            except Exception as e:
                logger.error(f"Failed to connect to MinIO, falling back to local: {e}")

_storage_provider_instance = None

def get_storage_provider() -> StorageProvider:
    global _storage_provider_instance
    if _storage_provider_instance is None:
        app_env = os.getenv("APP_ENV", "development").lower()
        default_provider = "minio" if app_env in ("production", "staging") else "local"
        provider_type = os.getenv("STORAGE_PROVIDER", default_provider).lower()
        if provider_type == "minio":
            _storage_provider_instance = MinIOStorageProvider()
        elif provider_type == "s3":
            _storage_provider_instance = S3StorageProvider()
        else:
            _storage_provider_instance = LocalStorageProvider()
    return _storage_provider_instance
