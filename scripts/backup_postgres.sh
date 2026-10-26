#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/opt/ispflow/backups
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/ispbilling_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
sudo -u postgres pg_dump -Fc ispbilling | gzip > "$OUT"
chmod 600 "$OUT"
echo "Backup written to $OUT"
