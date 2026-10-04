#!/bin/sh
# One-shot MinIO setup (compose service `minio-init`): the `games` and `adapters` buckets and a
# least-privilege user for the API (design invariant 8: root credentials never leave the storage
# host). Both buckets are public-read for single objects (no listing): games-edge serves them.
set -eu
mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
for bucket in games adapters; do
  mc mb --ignore-existing "local/$bucket"
  mc anonymous set download "local/$bucket"
done
mc admin policy create local play-api /policy/api-policy.json
mc admin user add local "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc admin policy attach local play-api --user "$S3_ACCESS_KEY_ID" || true
echo "minio-init: buckets games, adapters + user $S3_ACCESS_KEY_ID ready"
