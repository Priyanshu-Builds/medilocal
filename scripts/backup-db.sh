#!/usr/bin/env bash
# Nightly Postgres backup → S3 for the single-box pilot. Run from the repo root
# on the host via cron, e.g.:
#   0 3 * * *  cd /opt/medilocal && ./scripts/backup-db.sh >> /var/log/medilocal-backup.log 2>&1
#
# Needs: docker compose stack up, awscli configured, and BACKUP_S3_BUCKET set
# (in the environment or repo-root .env).
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

: "${POSTGRES_USER:?set POSTGRES_USER}"
: "${POSTGRES_DB:?set POSTGRES_DB}"
: "${BACKUP_S3_BUCKET:?set BACKUP_S3_BUCKET (e.g. s3://medilocal-backups)}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="medilocal-${stamp}.sql.gz"
compose="docker compose -f docker-compose.prod.yml"

echo "[$(date -u)] dumping $POSTGRES_DB → $file"
$compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean \
  | gzip -9 > "/tmp/${file}"

echo "[$(date -u)] uploading to ${BACKUP_S3_BUCKET}/${file}"
aws s3 cp "/tmp/${file}" "${BACKUP_S3_BUCKET}/${file}" --only-show-errors
rm -f "/tmp/${file}"

# Prune backups older than the retention window.
cutoff="$(date -u -d "${RETENTION_DAYS} days ago" +%Y%m%d 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%Y%m%d)"
aws s3 ls "${BACKUP_S3_BUCKET}/" | awk '{print $4}' | grep '^medilocal-' | while read -r key; do
  keydate="$(echo "$key" | sed -E 's/medilocal-([0-9]{8})T.*/\1/')"
  if [ -n "$keydate" ] && [ "$keydate" -lt "$cutoff" ]; then
    echo "[$(date -u)] pruning old backup $key"
    aws s3 rm "${BACKUP_S3_BUCKET}/${key}" --only-show-errors
  fi
done

echo "[$(date -u)] backup complete"
