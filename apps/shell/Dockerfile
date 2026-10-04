# syntax=docker/dockerfile:1
# Platform shell (Nuxt SSR). Build from the repository root:
#   docker build -f apps/shell/Dockerfile --build-arg VERSION=0.1.0 .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter @croffledev/play-shell...
RUN pnpm --filter @croffledev/play-shell... run build

FROM node:24-alpine AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/team-croffle/croffle-play" \
      org.opencontainers.image.title="croffle-play shell" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production APP_VERSION=${VERSION} HOST=0.0.0.0 PORT=3000
WORKDIR /app
# Nitro output is self-contained (server bundle + traced node_modules).
COPY --from=build --chown=node:node /repo/apps/shell/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
