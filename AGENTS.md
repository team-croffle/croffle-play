# AGENTS.md

Working agreement for AI agents on `croffle-play`.

## Project

**Croffle Play** — a web game platform run by Team Croffle. One account plays every game, like a
Steam account: the portal provides sign-in, the catalog, a dashboard, scores, saves, and
multiplayer rooms, and shows each game in its own iframe. Team members build games in their own
repositories, with any engine, and either **host them themselves** or **upload a build** for the
platform's game host to serve.

```
[Portal: Nuxt, www.<domain>] ── catalog / sign-in / dashboard / play page (common UI)
     │ iframe   https://<game>.play.<domain>/<entry>     (team's own host, or the platform's game host)
[Game site] ── built by the team; serves game.json and allows the portal to frame it
             (team hosting: anywhere; platform hosting: apps/games serves the uploaded zip from storage)
     │ postMessage (SDK protocol, pinned at build time)
[Host adapter vN] ── one per SDK major, picked from the game's __hello, loaded at runtime
     │ Core API (small, rarely changes)
[Portal core] ──► [API: NestJS] ──► PostgreSQL · S3 API (platform files: adapters, avatars)
```

Category peers: CrazyGames, Poki, itch.io. The point of this repository is the _platform_: it must
not grow with the number of games, and SDK releases must not require a portal deploy. Deployment and
operations (servers, proxies, DNS, backups) are **not** part of this repository.

### Purpose of this repository

Platform monorepo: portal (`apps/shell`), API, rooms server, host adapters, and the published
packages (`protocol`, `sdk`, `cli`, `create-game`). Games live in **their own repositories**
(created with `npm create @croffledev/play-game`, the template in `packages/create-game/template`)
and are never checked in here.

### Current state

- Exists: `apps/api` (NestJS 12 on Fastify, Drizzle; game registry, catalog, play info, SDK
  registry and lifecycle, scores, saves, game tokens + JWKS, server keys, members),
  `apps/shell` (Nuxt 4; catalog, detail, play page with runtime adapter loading, admin and
  developer pages), `apps/adapters` (v1), `apps/rooms` (shared WebSocket relay), `packages/protocol`,
  `apps/games` (game host for uploaded builds), `packages/sdk` (+ `/mock`), `packages/cli`
  (`validate`, `check`, `pack`, `deploy`), `packages/create-game`.
  Accounts: Logto (OIDC), admin by role. Per-subject rate limits, score trust policy.
- Games are registered by id; their origin comes from `GAME_ORIGIN_TEMPLATE`
  (`https://{id}.play.croffle-play.link`). The API reads `<origin>/game.json` on registration and
  refresh; `listed` decides catalog visibility.
- Hosting is per game: `team` (the default; the team serves the site) or `platform` (a zip
  uploaded by an admin, a game member, or CI with a deploy key `cdk_` is stored under
  `games/<id>/<deploy>/` and served by `apps/games` at the same origin). The platform keeps the
  last `DEPLOY_KEEP` uploads for rollback and takes `game.json` from the zip; it tracks no other
  game versions.
- Host adapters are uploaded to storage (`sdk:register <dist dir>`), served by the API at
  `/v1/adapters/…`, and relayed by the portal at `/adapters/…` (same origin, SRI-checked). Each
  platform release attaches the bundles (`adapters-v<N>-<version>.tar.gz`) for admins to register.
- Game servers are hosted by their teams and declared in `game.json` (`server: { url, protocol }`);
  the platform issues game tokens (JWKS) and server keys (`csk_`) for verified scores, nothing more.
- Players: dashboard `/me` (nickname, avatar upload — stored as `avatars/<user>/<hash>.<ext>`, served
  by the API and relayed at `/avatars/…`). Sessions stay in the sealed cookie, or in a
  Redis-protocol store (Valkey) with `NUXT_SESSION_REDIS_URL`.
- `pnpm dev:games` serves fixture games (`apps/shell/dev/games`) at `<id>.localhost:4100/` and adapter
  bundles at `localhost:4100/adapters/`, separate origins like production.
- API tests run the real migrations on in-memory PGlite; `DATABASE_URL=pglite://memory` also runs
  the API locally without Docker (development only).
- Remote: `team-croffle/croffle-play` (public). `master` is protected by a ruleset: PRs only,
  rebase merge, required checks `CI result`, `TruffleHog`, `Gitleaks`.
- `docs/ARCHITECTURE.md` is the design record (Korean); `docs/ROADMAP.md` the public roadmap.
  Security model: `docs/security.md`. Guides in `docs/guide/` (developer, admin), references in
  `docs/reference/` (SDK, app env). `docs/` is also a private workspace package
  (`@croffledev/play-docs`, VitePress) published to GitHub Pages by `docs.yml`; links that leave
  `docs/` are rewritten to GitHub. `README.md` describes the _target_ product.
- Domains (code reads them from env only): portal `game.croffle-play.link`, games
  `<id>.play.croffle-play.link`.

### Planned layout

| Path                   | Package                        | Ships as                       |
| ---------------------- | ------------------------------ | ------------------------------ |
| `apps/shell`           | `@croffledev/play-shell`       | Docker image (GHCR), private   |
| `apps/api`             | `@croffledev/play-api`         | Docker image (GHCR), private   |
| `apps/rooms`           | `@croffledev/play-rooms`       | Docker image (GHCR), private   |
| `apps/games`           | `@croffledev/play-games`       | Docker image (GHCR), private   |
| `apps/adapters`        | `@croffledev/play-adapters`    | Static bundles → storage (API) |
| `packages/protocol`    | `@croffledev/play-protocol`    | npm                            |
| `packages/sdk`         | `@croffledev/play-sdk`         | npm                            |
| `packages/cli`         | `@croffledev/play-cli`         | npm                            |
| `packages/create-game` | `@croffledev/create-play-game` | npm (`npm create`)             |
| `docs`                 | `@croffledev/play-docs`        | GitHub Pages (VitePress)       |

`apps/*` are `"private": true`. Workspace packages export a `"@croffledev/source"` condition
pointing at `src/`; `tsconfig.base.json` (`customConditions`) and each vitest config resolve it, so
packages typecheck and test against each other's source without a build. Builds use `dist`.

### Stack

- Node ≥ 24, pnpm (Corepack, version pinned in `package.json`), TypeScript.
- Portal: Nuxt (SSR for catalog/detail pages). API: NestJS on Fastify. Rooms: custom WebSocket
  server (`ws`, relay only).
- Data: PostgreSQL via Drizzle (migrations in `apps/api/drizzle`). Storage: **S3 API only**, one
  bucket for platform files (`adapters/`, `avatars/`) and uploaded game builds (`games/`).
- Validation: valibot (env, protocol messages, manifests). Identity: Logto (OIDC).
- The code depends on protocols (PostgreSQL, S3 API, OIDC, Redis protocol when used), never on a
  particular product or host. How and where it runs is decided outside this repository.
- Quality: oxlint (`.oxlintrc.json`), oxfmt (`.oxfmtrc.json`), lefthook (`lefthook.yml`),
  Changesets for `packages/*`.

### Commands

Run from the repo root.

```bash
pnpm install                 # also installs git hooks (lefthook)
pnpm check                   # completion gate: secret-files, format, lint, typecheck, test, build
pnpm format / pnpm lint:fix  # rewrite
pnpm format:check / pnpm lint / pnpm typecheck / pnpm test / pnpm build

pnpm dev:shell               # apps/shell (portal)
pnpm dev:api                 # apps/api
pnpm dev:games               # fixture games + adapters on :4100
pnpm --filter <pkg> <script> # single package

pnpm changeset               # after changing packages/*
```

Hooks: `pre-commit` (secret files, oxfmt + restage, oxlint, typecheck), `commit-msg`
(`scripts/hooks/check-commit-msg.sh`), `pre-push` (tests). Never bypass with `--no-verify`; fix the
cause. `pnpm check` is the same gate CI runs.

### Versioning

- **Platform (`apps/*`)**: git tags `vX.Y.Z` / `vX.Y.Z-rc.N` are the source of truth; nothing in the
  tree is bumped. The release workflow builds one image per app
  (`ghcr.io/team-croffle/croffle-play/<app>:<version>`).
- **Packages (`packages/*`)**: independent semver via Changesets, published to npm by the
  `Publish Packages` workflow through npm trusted publishing (OIDC). The workflow only stages
  versions (`npm stage publish`); a maintainer approves them with 2FA (`npm stage approve`) to go
  live. No npm token exists in the repository or its secrets; never add one. Never publish by hand
  (the one-time `0.0.0` name placeholders excepted).
- **SDK majors** are the platform's public contract and have their own lifecycle
  (`current → lts → old → deprecated`) stored in the database, not in code. See _Design invariants_
  5–6 and `docs/sdk-lifecycle.md`.
- **Games** have no platform version: their teams deploy them whenever they like.

### Design invariants

Changing any of these requires a decision entry in `.ai/history/`.

1. **The portal never embeds game code.** Every game runs in an `iframe` from its own origin,
   `https://<id>.play.<domain>/`, built from one `{id}` template. Portal bundle size and deploy
   frequency are independent of the number of games. Games are registered through the API, never
   through a portal release.
2. **Games are served at their own origin, by their team or by the platform.** Team hosting: the
   platform stores nothing and reads `game.json` from `<origin>/game.json`. Platform hosting: the
   team uploads a build (zip) and `apps/games` serves it from storage at the same
   `<id>.play.<domain>` origin, taking `game.json` from the zip. Either way the platform keeps the
   registration (id, name, listing, hosting mode), the manifest, and — for platform hosting — the
   last few uploads for rollback; it tracks no other game versions. Whether a game is shown is the
   `listed` flag.
3. **Games are same-site, so the portal defends itself.** The portal session cookie is host-only
   (`__Host-`), state-changing portal requests must come from the portal's own origin, and the API
   authenticates with tokens, never cookies. Games must allow the portal in `frame-ancestors`; the
   platform checks this (`play-cli check`) but cannot enforce what a game host serves.
4. **Authentication lives in the portal only.** A game never holds a platform session. Tier 1
   (default): the SDK proxies score/save calls through the portal via `postMessage`; the game sees
   only a public profile. Game servers get a short-lived JWT with `aud: game:<id>` delivered by
   `postMessage` — never in a query string — and verify it against the platform JWKS.
5. **The handshake is the only frozen protocol.** `__hello { sdk, game }` / `__welcome
{ capabilities }` never changes. Everything else is versioned by SDK major; a game is pinned to
   the SDK it was built with. Minor features are discovered via capabilities, never by version
   comparison.
6. **One host adapter per SDK major, loaded at runtime** with SRI verification. The portal picks
   it from the major in the game's `__hello`, fetches it from its own origin (`/adapters/…`, served
   by the API from storage), and exposes only `identity`, `api()`, `ui`, `lifecycle`. A new SDK
   feature is an API endpoint plus an adapter release — not a portal release. `old` SDK majors
   cannot be newly listed or refreshed; `deprecated` majors cannot be played.
7. **Game servers are untrusted and outside the platform.** A game declares its own server in
   `game.json`; its team hosts it. It reaches the platform only through the public API, identifies
   players by game tokens verified against the JWKS, and submits verified scores with a per-game
   server key. The platform never runs, networks with, or grants database access to game servers.
   Default multiplayer is the shared rooms server.
8. **Storage through the S3 API only**, in one bucket: platform-owned files (host adapters,
   avatars) and the uploaded builds of platform-hosted games (`games/<id>/…`). No storage
   credentials leave the platform; browsers never reach storage directly — `apps/games` reads
   the bucket and serves the files itself.
9. **Monorepo for the platform, one repository per game.** Game engines, build tools, hosting, and
   release cadence are the game team's choice; the platform constrains only the game contract
   (`game.json` at the origin root, an entry the portal may frame, an SDK major that is not old or
   deprecated).

### Domain notes

- `game.json`: `id`, `name`, `sdk` (semver range on one major), optional `version`, `entry`
  (default `index.html`), `thumbnail`, `orientation`, `server` (`url`, `protocol`).
- Reserved game ids: `www`, `api`, `admin`, `cdn`, `play`, `rooms`, `auth`, `static`
  (`RESERVED_GAME_IDS` in `packages/protocol`).
- Registration flow: admin registers an id → either the team deploys at `<id>.play.<domain>` →
  `play-cli check <url>` → admin refreshes `game.json` (id must match, SDK major current or lts),
  or the team uploads a build (`play-cli deploy` with a deploy key, or the portal) → admin lists
  the game. Platform-hosted games cannot be refreshed from the origin; a new upload replaces the
  manifest, `…/deploys/:id/activate` rolls back.
- Rooms (WebSocket): auth as the **first message** after connect, `Origin` check against the
  game origin template, 30 s ping, exponential-backoff reconnect with room re-join handled inside
  the SDK.
- Portal routes: `/game/:id` (SSR detail), `/game/:id/play` (iframe),
  `/game/:id/play?preview=1` (admin preview of unlisted games), `/admin/games/:id`, `/dev`.

## Workflow

- Local, gitignored workspace: `.ai/` (layout in `.ai/README.md`). Never copy
  its contents into committed files.
- Session start: `.ai/README.md` → latest `.ai/plan/` → latest `.ai/work/`.
- Internal versioned plan: `.ai/ROADMAP.local.md` (v0.1 … v1.0). The public
  `docs/ROADMAP.md` must stay free of internal status, names, and schedules.
- Loop: work from the current `.ai/work/` checklist → commit each finished
  sub-task → `pnpm check` before reporting done → write `.ai/history/` and
  delete the work file when the checklist is finished.
- Before a non-trivial decision, check prior ones:
  `grep -l 'decisions:.*<keyword>' .ai/history/*`.
- Branches: base is `master`; work on `type/topic` feature branches, rebase
  onto `master`, never commit on `master`.
- Commits: `type(scope): title` (≤72 chars, enforced by the hook), one-line
  summary, bulleted details, `Co-Authored-By` footer only. Scopes: `shell`,
  `api`, `rooms`, `games`, `adapters`, `protocol`, `sdk`, `cli`, `create-game`, `ci`,
  `docs` (omit when repo-wide). Human-facing version of these rules:
  `CONTRIBUTING.md` (+ `.ko.md`); keep them in sync.
- `packages/*` change → add a Changeset in the same commit series.

### Conventions

- Formatting is owned by oxfmt: 2 spaces, single quotes, semicolons, trailing
  commas, print width 100, LF. Don't hand-format; run `pnpm format`.
- File names: **kebab-case** for all TypeScript and Vue files. PascalCase only
  for identifiers.
- `*.ts` files stay under 300 lines (oxlint `max-lines`); split modules.
- `apps/api`, `apps/rooms`: `typescript/consistent-type-imports` is off there
  on purpose — NestJS DI needs runtime imports for constructor parameters.
  Do not re-enable it. Inject with explicit tokens (`@Inject(TOKEN)`): tests
  (vitest) and dev (tsx) do not emit decorator metadata.
- Portal (Nuxt, `apps/shell`): no game-specific code, no per-game branches. Anything a
  game needs goes through the protocol → adapter → API path.
- Protocol/SDK: every message type is defined once in `packages/protocol`;
  `sdk` and `adapters` import it. Breaking a message = new SDK major.
- Secrets: `.env*` are never read or committed. `*.example` files document
  variables.

### Skills (`.claude/skills/`)

Shared rules: `play-workflow/SKILL.md` (versions, file templates, work / test
/ PR / release procedures). Each skill below reads it first.

| Skill                        | Does                                                            |
| ---------------------------- | --------------------------------------------------------------- |
| `gen-roadmap <what>`         | Add items or a version to `.ai/ROADMAP.local.md`                |
| `plan-next`, `plan-to <ver>` | Write `.ai/plan/` for the next / every version up to `<ver>`    |
| `gen-work [ver]`             | Write `.ai/work/` files from a plan                             |
| `work-next`, `work-to <tgt>` | Implement work items (one / up to N, rc, version)               |
| `test [ver]`                 | Gates + smoke + scenarios → `.ai/test/`                         |
| `gen-pr`                     | Draft the PR body in `.ai/pr/`                                  |
| `go-ci`                      | Push, PR, checks, Rebase-and-Merge                              |
| `release [rc]`               | rc release via `release.yml`                                    |
| `go-cicd [rc]`               | `go-ci` + `release`                                             |
| `release-prod <ver>`         | Stable release, explicit request only                           |
| `work-cicd-to <ver-rc>`      | plan → work → test → go-cicd up to an rc                        |
| `workflow <context>`         | Judge, adjust the roadmap, run `work-cicd-to` (+ prod if asked) |

Skills that push, merge, or release are user-invoked only.

## Language

- `AGENTS.md`: English. `CLAUDE.md` contains only `@AGENTS.md`.
- Public docs: `README.md` English with `README.ko.md` beside it. `docs/` and
  `.ai/` notes: Korean. Code, commits, PRs, release notes: English.
