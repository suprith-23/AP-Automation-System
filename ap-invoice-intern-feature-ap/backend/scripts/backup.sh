#!/bin/bash
set -euo pipefail

DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_USER=${POSTGRES_USER:-postgres}
DB_NAME=${POSTGRES_DB:-ap_db}
export PGPASSWORD=${POSTGRES_PASSWORD:-postgres}

RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
BACKUP_DIR="/app/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Starting database backup for $DB_NAME..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
echo "Backup saved locally to $BACKUP_FILE"

# --- Offsite upload to MinIO / S3 ---
# Requires MinIO Client (mc) to be installed in the container.
# Set MINIO_BACKUP_BUCKET, MINIO_ALIAS, MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
# in the environment (or inherit from .env).
MINIO_ALIAS=${MINIO_ALIAS:-minio_local}
MINIO_ENDPOINT=${MINIO_ENDPOINT:-http://minio:9000}
MINIO_BUCKET=${MINIO_BACKUP_BUCKET:-ap-db-backups}

if command -v mc &>/dev/null; then
    # Configure alias if not already done (idempotent)
    mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" \
        "${MINIO_ROOT_USER:-minioadmin}" "${MINIO_ROOT_PASSWORD:-minioadmin}" --quiet

    # Ensure bucket exists
    mc mb --ignore-existing "$MINIO_ALIAS/$MINIO_BUCKET" --quiet

    # Upload backup file
    mc cp "$BACKUP_FILE" "$MINIO_ALIAS/$MINIO_BUCKET/" --quiet
    echo "Backup uploaded to MinIO: $MINIO_ALIAS/$MINIO_BUCKET/$(basename "$BACKUP_FILE")"

    # Remove offsite copies older than retention window
    mc rm --recursive --force \
        --older-than "${RETENTION_DAYS}d" \
        "$MINIO_ALIAS/$MINIO_BUCKET/" 2>/dev/null || true
    echo "Offsite retention policy enforced ($RETENTION_DAYS days)."
else
    echo "WARNING: MinIO Client (mc) not found. Skipping offsite upload." >&2
    echo "Install mc in the backup container to enable offsite durability." >&2
fi

# --- Local retention cleanup ---
echo "Enforcing local retention policy of $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -exec rm {} \;
echo "Local cleanup completed."
