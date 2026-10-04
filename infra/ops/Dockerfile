# Ops container: nightly backups and the health watcher, on cron.
FROM minio/mc:latest AS mc

FROM postgres:17-alpine
RUN apk add --no-cache curl
COPY --from=mc /usr/bin/mc /usr/bin/mc
COPY backup.sh healthcheck.sh /ops/
COPY crontab /etc/crontabs/root
RUN chmod +x /ops/*.sh
CMD ["crond", "-f", "-l", "8"]
