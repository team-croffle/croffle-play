#!/bin/sh
# Nightly backup (ops container, cron): PostgreSQL dumps of the platform and Logto databases, and a
# mirror of the storage buckets. Bundles are immutable, so the mirror only ever adds files.
# Restore: docs/operations.md.
set -eu

DEST=${BACKUP_DIR:-/backups}
RETENTION_DAYS=${RETENTION_DAYS:-14}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
PG_HOST=${PG_HOST:-postgres}
PG_PORT=${PG_PORT:-5432}

log() { echo "$(date -u +%FT%TZ) backup: $*"; }

mkdir -p "$DEST/pg" "$DEST/storage"
# A failed run must not leave a partial dump that looks like a backup.
trap 'rm -f "$DEST"/pg/*.part' EXIT

# Unquoted on purpose: a space-separated list of database names.
for db in ${BACKUP_DATABASES:-$POSTGRES_DB logto}; do
  out="$DEST/pg/$db-$STAMP.dump"
  # Write to a temporary name first: a failed run never leaves a truncated dump behind.
  PGPASSWORD=$POSTGRES_PASSWORD pg_dump --host="$PG_HOST" --port="$PG_PORT" \
    --username="$POSTGRES_USER" --format=custom --no-owner --dbname="$db" --file="$out.part"
  mv "$out.part" "$out"
  log "dumped $db ($(du -h "$out" | cut -f1))"
done

if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
  # rclone remote `src` from the environment; works with any S3 API (MinIO, AIStor, R2).
  export RCLONE_CONFIG_SRC_TYPE=s3
  export RCLONE_CONFIG_SRC_PROVIDER=Minio
  export RCLONE_CONFIG_SRC_ENDPOINT="$BACKUP_S3_ENDPOINT"
  export RCLONE_CONFIG_SRC_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
  export RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
  for bucket in ${BACKUP_BUCKETS:-games adapters}; do
    # copy, not sync: objects removed from storage stay in the backup.
    rclone copy --quiet "src:$bucket" "$DEST/storage/$bucket"
    log "mirrored bucket $bucket"
  done
fi

find "$DEST/pg" -name '*.dump' -mtime +"$RETENTION_DAYS" -print -delete | sed 's/^/pruned /'
log "done"
