# Infrastructure

Single-server deployment with Docker Compose behind Cloudflare. Everything talks S3 for storage, so
MinIO can be swapped for R2/S3/another S3-compatible store by configuration only.

```
                   Cloudflare (DNS, TLS, cache, Tunnel)
 play.croffledev.kr ──────────► shell :3000 ──► api :3001 ──► postgres
 api.play.croffledev.kr ──────────────────────► api :3001 ──► minio (S3)
 static.play.croffledev.kr ──► games-edge :8080 ──► minio /adapters/…
 <id>.croffle-play.link ─────► games-edge :8080 ──► minio /games/<id>/…
```

Two registered domains on purpose: games are untrusted code, and a game on a subdomain of the
platform domain could set cookies for it or make same-site requests with the player's session.

## Services (`compose.yml`)

| Service      | Port (host)    | Networks                | Notes                                    |
| ------------ | -------------- | ----------------------- | ---------------------------------------- |
| `postgres`   | —              | data-net                | API only                                 |
| `minio`      | 127.0.0.1:9000 | storage-net             | S3 API; console on 127.0.0.1:9001        |
| `minio-init` | —              | storage-net             | one-shot: buckets, API user, public-read |
| `games-edge` | 127.0.0.1:8080 | storage-net             | nginx; read-only container               |
| `api`        | 127.0.0.1:3001 | platform, data, storage | migrations run on start                  |
| `shell`      | 127.0.0.1:3000 | platform-net            | never talks to the database or storage   |

## Environment (`infra/.env`, from `.env.example`)

| Variable                  | Used by           | Meaning                                                        |
| ------------------------- | ----------------- | -------------------------------------------------------------- |
| `POSTGRES_PASSWORD`       | postgres, api     | Database password                                              |
| `MINIO_ROOT_PASSWORD`     | minio, minio-init | Storage root password (stays on the storage host)              |
| `S3_ACCESS_KEY_ID/SECRET` | minio-init, api   | Least-privilege API storage user (`minio/api-policy.json`)     |
| `S3_PUBLIC_ENDPOINT`      | api               | Host in presigned upload URLs; must be reachable by CI runners |
| `GAME_URL_TEMPLATE`       | api               | `https://{id}.croffle-play.link/{version}/`                    |
| `OIDC_ISSUER/AUDIENCE`    | api, shell        | Logto issuer (`…/oidc`) and the API resource identifier        |
| `OIDC_CLIENT_ID/SECRET`   | shell             | The shell's Logto application                                  |
| `SITE_URL`                | shell             | Public shell URL (OIDC redirect URIs; https → secure cookie)   |
| `ADMIN_SUBS`              | api               | IdP subjects promoted to admin when they sign in               |
| `NUXT_SESSION_PASSWORD`   | shell             | Seals the session cookie (≥ 32 chars)                          |
| `NUXT_CSP_FRAME_SRC`      | shell             | `https://*.croffle-play.link`                                  |
| `NUXT_CSP_CONNECT_SRC`    | shell             | `https://static.play.croffledev.kr` (adapter host)             |
| `GAME_DOMAIN(_REGEX)`     | games-edge        | `croffle-play.link` / `croffle-play\.link`                     |
| `STATIC_HOST`             | games-edge        | Adapter host, `static.play.croffledev.kr`                      |
| `PLATFORM_ORIGIN`         | games-edge        | Only origin allowed to frame games and fetch adapters          |
| `ROOMS_ORIGIN`            | games-edge        | Rooms server, allowed in games' `connect-src`                  |

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

## Cloudflare

1. DNS: CNAMEs for `play`, `api.play`, `static.play` (croffledev.kr) and `*` (croffle-play.link) to the
   tunnel (`cloudflared/config.example.yml`). Universal SSL covers `*.croffle-play.link`; deeper
   names (`*.srv.croffle-play.link`, game servers) need an advanced certificate.
2. Cache Rule on `*.croffle-play.link` and `static.play.croffledev.kr`: _Eligible for cache_, edge TTL
   _use origin Cache-Control_. Bundles are immutable, so nothing ever needs purging.
3. Uploads use presigned URLs to `S3_PUBLIC_ENDPOINT`. Cloudflare limits request bodies (100 MB on
   the free plan), so expose storage on a host that does not go through the proxy, or keep bundles
   under that size.

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

MinIO no longer publishes community binaries or images; `minio/minio:latest` may stop receiving
updates. The platform uses only the S3 API (`S3_*` variables), so Garage, SeaweedFS, or Cloudflare
R2 can replace it without code changes.
