#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_USER=${POSTGRES_USER:-postgres}
DB_NAME=${POSTGRES_DB:-ap_db}
export PGPASSWORD=${POSTGRES_PASSWORD:-postgres}

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file $BACKUP_FILE not found."
    exit 1
fi

echo "Restoring database from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
echo "Database restoration completed successfully."
