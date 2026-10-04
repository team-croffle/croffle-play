#!/bin/sh
# Enforces `type(scope): title`, then a blank line before any body.
msg_file="$1"
header=$(head -n 1 "$msg_file")

case "$header" in
  Merge\ *|Revert\ *|fixup!\ *|squash!\ *) exit 0 ;;
esac

types='feat|fix|docs|chore|refactor|test|perf|build|ci|style|revert|release'
if ! printf '%s\n' "$header" | grep -Eq "^($types)(\([a-z0-9._/-]+\))?!?: .+"; then
  echo "commit-msg: header must be 'type(scope): title'" >&2
  echo "  types: $(printf '%s' "$types" | sed 's/|/, /g')" >&2
  echo "  got:   $header" >&2
  exit 1
fi

if [ "${#header}" -gt 72 ]; then
  echo "commit-msg: header is ${#header} chars (max 72)" >&2
  exit 1
fi

second=$(sed -n '2p' "$msg_file")
if [ -n "$second" ]; then
  echo "commit-msg: line 2 must be blank" >&2
  exit 1
fi
