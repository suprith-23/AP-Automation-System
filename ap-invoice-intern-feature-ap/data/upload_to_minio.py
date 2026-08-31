import os
import sys

try:
    from minio import Minio
    from minio.error import S3Error
except ImportError:
    print("MinIO library not installed. Please run: pip install minio")
    sys.exit(1)

# MinIO config from .env (adapted for localhost access)
MINIO_ENDPOINT = "localhost:9000"
MINIO_ACCESS_KEY = "minioadmin"
MINIO_SECRET_KEY = "minioadmin"
BUCKET_NAME = "ap-automation-invoices"

def main():
    client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False
    )
    
    # Ensure bucket exists
    found = client.bucket_exists(BUCKET_NAME)
    if not found:
        client.make_bucket(BUCKET_NAME)
        print(f"Created bucket {BUCKET_NAME}")
    else:
        print(f"Bucket {BUCKET_NAME} already exists")

    images_dir = "hf_invoices/images"
    
    if not os.path.exists(images_dir):
        print(f"Directory {images_dir} does not exist.")
        sys.exit(1)

    for i in range(5):
        filename = f"invoice_{i}.jpg"
        filepath = os.path.join(images_dir, filename)
        
        if os.path.exists(filepath):
            object_name = f"hf_invoices/{filename}"
            client.fput_object(
                BUCKET_NAME, 
                object_name, 
                filepath,
                content_type="image/jpeg"
            )
            print(f"Uploaded {filename} to MinIO bucket {BUCKET_NAME} as {object_name}")
        else:
            print(f"File {filepath} not found.")

if __name__ == "__main__":
    main()
