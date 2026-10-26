#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
sudo -u postgres psql -d ispbilling -c "SELECT 1" >/dev/null
gunzip -c "$BACKUP_FILE" | sudo -u postgres pg_restore --clean --if-exists -d ispbilling
echo "Restore completed from $BACKUP_FILE"
