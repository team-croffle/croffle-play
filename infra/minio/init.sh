#!/bin/sh
# One-shot MinIO setup (compose service `minio-init`): private `games` bucket and a least-privilege
# user for the API (design invariant 8: root credentials never leave the storage host).
set -eu
mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing local/games
mc anonymous set none local/games
mc admin policy create local play-api /policy/api-policy.json
mc admin user add local "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc admin policy attach local play-api --user "$S3_ACCESS_KEY_ID" || true
echo "minio-init: bucket games + user $S3_ACCESS_KEY_ID ready"
