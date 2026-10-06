# syntax=docker/dockerfile:1
# Game host (uploaded builds, from storage). Build from the repository root:
#   docker build -f apps/games/Dockerfile --build-arg VERSION=0.1.0 .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
# Root `prepare` installs git hooks; there is no git here.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter @croffledev/play-games...
RUN pnpm --filter @croffledev/play-games... run build
RUN pnpm --filter @croffledev/play-games deploy --prod --ignore-scripts /out

FROM node:24-alpine AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/team-croffle/croffle-play" \
      org.opencontainers.image.title="croffle-play games" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production APP_VERSION=${VERSION} PORT=3003
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
