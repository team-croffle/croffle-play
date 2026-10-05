#!/bin/sh
# One-shot MinIO / AIStor setup (compose service `minio-init`): the `games` and `adapters` buckets
# and a least-privilege user for the API (design invariant 8: root credentials never leave the
# storage host). Both buckets are public-read for single objects (no listing): games-edge serves them.
set -eu
# Against the production store, from the repository root on a host with `mc`:
#   MINIO_ENDPOINT=https://<aistor> POLICY_DIR=infra/minio MINIO_ROOT_USER=... sh infra/minio/init.sh
POLICY_DIR=${POLICY_DIR:-/policy}
mc alias set local "${MINIO_ENDPOINT:-http://minio:9000}" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
for bucket in games adapters; do
  mc mb --ignore-existing "local/$bucket"
  mc anonymous set download "local/$bucket"
done
mc admin policy create local play-api "$POLICY_DIR/api-policy.json"
mc admin user add local "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc admin policy attach local play-api --user "$S3_ACCESS_KEY_ID" || true
if [ -n "${BACKUP_S3_ACCESS_KEY:-}" ]; then
  mc admin policy create local play-backup "$POLICY_DIR/backup-policy.json"
  mc admin user add local "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY"
  mc admin policy attach local play-backup --user "$BACKUP_S3_ACCESS_KEY" || true
fi
echo "minio-init: buckets games, adapters + user $S3_ACCESS_KEY_ID ready"
