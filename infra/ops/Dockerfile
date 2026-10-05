# Ops container: nightly backups and the health watcher, on cron.
# pg_dump comes from the base image; it must be at least the PostgreSQL server's major version.
FROM postgres:17-alpine
RUN apk add --no-cache curl rclone
COPY backup.sh healthcheck.sh /ops/
COPY crontab /etc/crontabs/root
RUN chmod +x /ops/*.sh
CMD ["crond", "-f", "-l", "8"]
