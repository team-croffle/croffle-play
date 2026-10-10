# syntax=docker/dockerfile:1
# Platform API. Build from the repository root:
#   docker build -f apps/api/Dockerfile --build-arg VERSION=0.1.0 .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG VERSION=dev
COPY . .
# Root `prepare` installs git hooks; there is no git here.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
      --filter @croffledev/play-api... --filter "@croffledev/play-adapter-v*..."
RUN pnpm --filter @croffledev/play-api... run build
# The host adapter packages ride along as the offline bootstrap: the api registers them at boot
# when a major has no adapter yet (ADAPTER_AUTO_REGISTER); newer ones come from npm.
RUN pnpm --filter "@croffledev/play-adapter-v*" run build \
 && for d in packages/adapter-v*; do \
      v=$(node -p "require('./$d/package.json').version"); \
      m=$(node -p "require('./$d/package.json').croffle.sdkMajor"); \
      mkdir -p "/adapters/v$m/$v" && cp "$d"/dist/index.js "$d"/dist/manifest.json "/adapters/v$m/$v/"; \
    done
RUN pnpm --filter @croffledev/play-api deploy --prod --ignore-scripts /out

FROM node:24-alpine AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/team-croffle/croffle-play" \
      org.opencontainers.image.title="croffle-play api" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production APP_VERSION=${VERSION} PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --from=build --chown=node:node /adapters ./adapters
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main.js"]
