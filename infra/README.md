# Infrastructure

Single-server deployment with Docker Compose behind Cloudflare. PostgreSQL and the S3 store (MinIO
AIStor) already run on the server; `compose.yml` reaches them through env variables. Everything
talks S3 for storage, so the store can be swapped for R2/S3/another S3-compatible store by
configuration only.

```
                   Cloudflare (DNS, TLS, cache, Tunnel)
 play.croffledev.kr ──────────► shell :3000 ──► api :3001 ──► PostgreSQL (DATABASE_URL)
 api.play.croffledev.kr ──────────────────────► api :3001 ──► S3 store (S3_ENDPOINT)
 rooms.play.croffledev.kr ───► rooms :3002 (WebSocket; tokens checked against the API's JWKS)
 static.play.croffledev.kr ──► games-edge :8080 ──► S3 store /adapters/…
 <id>.croffle-play.link ─────► games-edge :8080 ──► S3 store /games/<id>/…
```

| Where                 | Command                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Server                | `docker compose -f infra/compose.yml --env-file infra/.env up -d`                                 |
| Local (bundled DB/S3) | `docker compose -f infra/compose.yml -f infra/compose.local.yml --env-file infra/.env up --build` |

`compose.local.yml` adds `postgres`, `minio` (frozen `bitnamilegacy/minio` build; development only),
and `minio-init`; the env defaults in `compose.yml` point at them.

Two registered domains on purpose: games are untrusted code, and a game on a subdomain of the
platform domain could set cookies for it or make same-site requests with the player's session.

## Services (`compose.yml`)

| Service      | Port (host)    | Networks                | Notes                                        |
| ------------ | -------------- | ----------------------- | -------------------------------------------- |
| `postgres`   | —              | data-net                | local only (`compose.local.yml`)             |
| `minio`      | 127.0.0.1:9000 | storage-net             | local only; S3 API, console on :9001         |
| `minio-init` | —              | storage-net             | local only; buckets, API/backup users        |
| `games-edge` | 127.0.0.1:8080 | storage-net             | nginx; read-only container; `/healthz`       |
| `api`        | 127.0.0.1:3001 | platform, data, storage | migrations run on start                      |
| `rooms`      | 127.0.0.1:3002 | platform-net            | WebSocket relay; verifies game tokens (JWKS) |
| `shell`      | 127.0.0.1:3000 | platform-net            | never talks to the database or storage       |

## Environment (`infra/.env`, from `.env.example`)

| Variable                   | Used by           | Meaning                                                                               |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | api               | Platform database; default is the bundled `postgres` (local)                          |
| `LOGTO_DB_URL`             | logto             | Logto database (`logto` on the same server)                                           |
| `PG_HOST/PG_PORT`          | ops               | PostgreSQL host for `pg_dump` (with `POSTGRES_USER/PASSWORD/DB`)                      |
| `POSTGRES_PASSWORD`        | postgres, ops     | Bundled database password (local); backup user's password on the server               |
| `S3_ENDPOINT`              | api               | S3 API inside the network, e.g. the AIStor URL                                        |
| `STORAGE_UPSTREAM`         | games-edge        | `host:port` of the same S3 API (plain HTTP)                                           |
| `BACKUP_S3_ENDPOINT`       | ops               | S3 API for the nightly bucket copy (rclone)                                           |
| `MINIO_ROOT_PASSWORD`      | minio, minio-init | Bundled store root password (local; never leaves the storage host)                    |
| `S3_ACCESS_KEY_ID/SECRET`  | minio-init, api   | Least-privilege API storage user (`minio/api-policy.json`)                            |
| `S3_PUBLIC_ENDPOINT`       | api               | Host in presigned upload URLs; must be reachable by CI runners                        |
| `GAME_URL_TEMPLATE`        | api               | `https://{id}.croffle-play.link/{version}/`                                           |
| `OIDC_ISSUER/AUDIENCE`     | api, shell        | Logto issuer (`…/oidc`) and the API resource identifier                               |
| `OIDC_CLIENT_ID/SECRET`    | shell             | The shell's Logto application                                                         |
| `SITE_URL`                 | shell             | Public shell URL (OIDC redirect URIs; https → secure cookie)                          |
| `ADMIN_SUBS`               | api               | IdP subjects promoted to admin when they sign in                                      |
| `JWT_SIGNING_KEY`          | api               | ES256 key for game tokens (`aud: game:<id>`); JWKS at `/.well-known/jwks.json`        |
| `PUBLIC_API_ORIGIN`        | api               | `iss` of game tokens, `https://api.play.croffledev.kr`                                |
| `GAME_SERVER_URL_TEMPLATE` | api               | `https://{id}.srv.croffle-play.link` (approved game servers)                          |
| `GITHUB_NOTIFY_TOKEN`      | api               | Fine-grained token (Issues: write) for SDK deprecation issues; logged only when unset |
| `SDK_MIGRATION_GUIDE_URL`  | api               | Linked from publish refusals and deprecation issues                                   |
| `NUXT_SESSION_PASSWORD`    | shell             | Seals the session cookie (≥ 32 chars)                                                 |
| `NUXT_CSP_FRAME_SRC`       | shell             | `https://*.croffle-play.link`                                                         |
| `NUXT_CSP_CONNECT_SRC`     | shell             | `https://static.play.croffledev.kr` (adapter host)                                    |
| `GAME_DOMAIN(_REGEX)`      | games-edge        | `croffle-play.link` / `croffle-play\.link`                                            |
| `STATIC_HOST`              | games-edge        | Adapter host, `static.play.croffledev.kr`                                             |
| `PLATFORM_ORIGIN`          | games-edge        | Only origin allowed to frame games and fetch adapters                                 |
| `ROOMS_ORIGIN`             | games-edge        | Rooms server, allowed in games' `connect-src`                                         |

## Identity (Logto)

`logto` runs on the same PostgreSQL server in its own database (`postgres/init/01-logto.sql`, applied
on a fresh volume). Public endpoint `https://auth.play.croffledev.kr`; the admin console listens on
127.0.0.1:3302 only (SSH tunnel). In the console:

1. **API resource**: identifier `https://api.play.croffledev.kr` (= API `OIDC_AUDIENCE`).
2. **Traditional web application** for the shell: redirect URI
   `https://play.croffledev.kr/auth/callback`, post sign-out redirect `https://play.croffledev.kr/`;
   copy its id/secret to `NUXT_OIDC_CLIENT_ID` / `NUXT_OIDC_CLIENT_SECRET`.
3. The first platform admin: put their Logto user id in `ADMIN_SUBS` (promoted at sign-in), or after
   they signed in once: `docker compose exec api node dist/auth/grant-admin-cli.js <sub>`.

Locally, `pnpm dev:oidc` runs a stand-in provider on `http://localhost:4300` (any login name).

## Game domain rules (`nginx/templates/game-domain.conf.template`)

- `<id>.<game domain>/<version>/<path>` → `games/<id>/<version>/<path>`; directories serve
  `index.html`; unversioned paths, reserved ids (`www`, `api`, `admin`, `cdn`, `play`, `rooms`,
  `auth`, `static`, `preview`, `srv`), and anything but GET/HEAD are refused.
- Paths containing `..` or encoded separators are refused, so one game's files can never be served
  on another game's origin.
- `Set-Cookie` and storage headers are stripped; CSP allows only the bundle itself, the rooms server,
  and the game's own `<id>.srv.` host, and `frame-ancestors` is the platform origin.
- Successful responses are `immutable` for a year; errors are `no-store`.

## Traefik in front (Cloudflare DNS only)

When Cloudflare only serves DNS ("DNS only", no proxy), an existing Traefik terminates TLS and routes
by host. `compose.traefik.yml` adds the labels and attaches shell, api, rooms, logto, and games-edge to
`TRAEFIK_NETWORK`:

```bash
docker compose -f infra/compose.yml -f infra/compose.traefik.yml --env-file infra/.env up -d
```

- DNS: `A` records (DNS only) for `play`, `api.play`, `rooms.play`, `static.play`, `auth.play`,
  `*.croffle-play.link`, and `*.srv.croffle-play.link` to the server.
- Certificates: the game domain needs a wildcard, so the resolver must use DNS-01 (Cloudflare API
  token with Zone DNS edit on both zones). `TRAEFIK_ENTRYPOINT` / `TRAEFIK_CERTRESOLVER` name them.
- Traefik also joins `games-net` so approved game servers (`<id>.srv.…`) are reachable.
- Without the Cloudflare cache every bundle request reaches the server; bundles are `immutable`, so
  browsers fetch each file once.

## Cloudflare (proxy and Tunnel)

1. DNS: CNAMEs for `play`, `api.play`, `static.play` (croffledev.kr) and `*` (croffle-play.link) to the
   tunnel (`cloudflared/config.example.yml`). Universal SSL covers `*.croffle-play.link`; deeper
   names (`*.srv.croffle-play.link`, game servers) need an advanced certificate.
2. Cache Rule on `*.croffle-play.link` and `static.play.croffledev.kr`: _Eligible for cache_, edge TTL
   _use origin Cache-Control_. Bundles are immutable, so nothing ever needs purging.
3. Uploads use presigned URLs to `S3_PUBLIC_ENDPOINT`. Cloudflare limits request bodies (100 MB on
   the free plan), so expose storage on a host that does not go through the proxy, or keep bundles
   under that size.

## Tier 2 game servers

Approved game servers run from compose fragments generated by the API
(`GET /v1/admin/games/<id>/server/compose`, also on the admin page) — see
[game-servers/README.md](./game-servers/README.md). They join only `games-net`, which `compose.yml`
names explicitly so fragments can attach to it; a Traefik instance on that network routes
`<id>.srv.croffle-play.link`. That name is two levels below the game domain, so Cloudflare's
Universal SSL does not cover it: use an advanced certificate for `*.srv.croffle-play.link` or
terminate TLS at Traefik.

## Backups and monitoring

The `ops` service (infra/ops) dumps PostgreSQL (platform and Logto; `pg_dump` 17, so the server must
not be newer) and copies the `games` and `adapters` buckets nightly with rclone and a read-only
storage user, keeping 14 days of dumps, and alerts
`ALERT_WEBHOOK_URL` (Discord) when a health URL goes down or recovers. Procedures, including
restore: [docs/operations.md](../docs/operations.md).

## Releasing a host adapter

Adapters are platform code, versioned with the platform tag:

```bash
VERSION=1.0.0 pnpm --filter @croffledev/play-adapters build     # dist/v1/1.0.0/{index.js,manifest.json}
mc cp --recursive apps/adapters/dist/v1/1.0.0/ local/adapters/v1/1.0.0/
docker compose exec api node dist/sdk/register-cli.js \
  https://static.play.croffledev.kr/adapters/v1/1.0.0/manifest.json
```

Registering only changes the adapter URL and SRI hash of that SDK major; lifecycle status
(`current` … `eol`) is data and changed deliberately.

## Local development without Docker

`pnpm dev:games` serves fixture games on `http://<id>.localhost:4100/` (Chrome and Firefox resolve
`*.localhost`; Safari needs hosts-file entries) and the API runs on embedded PGlite
(`DATABASE_URL=pglite://memory`). See the root README.

## Storage engine note

MinIO no longer publishes community images (`minio/minio`, `minio/mc` are gone from Docker Hub).
Production uses MinIO AIStor; set up its buckets and users once with the same script, from the
repository root on a host with `mc`:

```bash
MINIO_ENDPOINT=https://<aistor> POLICY_DIR=infra/minio MINIO_ROOT_USER=… MINIO_ROOT_PASSWORD=… \
  S3_ACCESS_KEY_ID=play-api S3_SECRET_ACCESS_KEY=… \
  BACKUP_S3_ACCESS_KEY=play-backup BACKUP_S3_SECRET_KEY=… sh infra/minio/init.sh
```

Backups copy buckets with rclone, which works with any S3 API. The platform uses only the S3 API
(`S3_*` variables), so R2, S3, Garage, or SeaweedFS can replace AIStor without code changes.
