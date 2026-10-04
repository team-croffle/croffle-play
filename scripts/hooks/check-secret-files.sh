#!/bin/sh
# Blocks secret-bearing files. Args: file paths (defaults to staged files).
if [ "$#" -eq 0 ]; then
  set -- $(git diff --cached --name-only --diff-filter=ACMR)
fi

status=0
for f in "$@"; do
  name=$(basename "$f")
  case "$name" in
    *.example) continue ;;
    .env|.env.*|*.properties|*.pem|*.key|id_rsa*|id_ed25519*)
      echo "secret-files: refusing to commit $f" >&2
      status=1 ;;
  esac
  case "$f" in
    secrets/*|*/secrets/*)
      echo "secret-files: refusing to commit $f" >&2
      status=1 ;;
  esac
done
exit $status
