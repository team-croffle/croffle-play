# Optional: serve the game as a container (any static host works — see README.md).
#   docker build -t my-game . && docker run -p 8080:8080 -e PORTAL_ORIGIN=https://game.croffle-play.link my-game
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN pnpm build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
# The portal that may show the game in its iframe.
ENV PORTAL_ORIGIN=https://game.croffle-play.link
EXPOSE 8080
