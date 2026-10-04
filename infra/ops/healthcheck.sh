#!/bin/sh
# Health watcher (ops container, cron every minute): checks each URL in HEALTH_URLS and posts to a
# Discord webhook when a service goes down or comes back — once per change, not every minute.
set -u

STATE_DIR=${STATE_DIR:-/var/lib/healthcheck}
mkdir -p "$STATE_DIR"

notify() {
  [ -n "${ALERT_WEBHOOK_URL:-}" ] || return 0
  body=$(printf '{"content":"%s"}' "$1" | sed 's/\\/\\\\/g')
  curl -fsS -m 10 -H 'content-type: application/json' -d "$body" "$ALERT_WEBHOOK_URL" >/dev/null ||
    echo "healthcheck: webhook failed" >&2
}

for url in ${HEALTH_URLS:-}; do
  key=$(printf '%s' "$url" | tr -c 'A-Za-z0-9' '_')
  previous=$(cat "$STATE_DIR/$key" 2>/dev/null || echo up)
  if curl -fsS -m 5 -o /dev/null "$url"; then now=up; else now=down; fi
  if [ "$now" != "$previous" ]; then
    if [ "$now" = down ]; then
      notify ":red_circle: Croffle Play: $url is DOWN"
    else
      notify ":green_circle: Croffle Play: $url is back up"
    fi
    echo "$now" >"$STATE_DIR/$key"
  fi
  echo "$(date -u +%FT%TZ) $now $url"
done
