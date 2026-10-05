# AGENTS.md

Working agreement for AI agents on `croffle-play`.

## Project

**Croffle Play** — a web game platform run by Team Croffle. Team members build
games in their own repositories, with any engine, and publish them to the
platform; the platform provides the catalog, one shared account, scores and
saves, multiplayer rooms, and the SDK that games talk to.

```
[Shell: Nuxt] ── catalog / login / play page
     │ iframe   https://<game>.croffle-play.link/<version>/index.html
[Game bundle] ── built by the team member, immutable per version
     │ postMessage (SDK protocol, pinned at build time)
[Host adapter vN] ── one per SDK major, loaded by the shell at runtime
     │ Core API (small, rarely changes)
[Shell core] ──► [API: NestJS] ──► PostgreSQL · S3 storage (MinIO)
```

Category peers: CrazyGames, Poki, itch.io. The point of this repository is the
_platform_: it must not grow with the number of games, and SDK releases must
not require a shell deploy.

### Purpose of this repository

Platform monorepo: shell, API, rooms server, host adapters, and the published
packages (`protocol`, `sdk`, `cli`, `create-game`). Games live in **their own
repositories** (created with `npm create @croffledev/play-game`, the template in
`packages/create-game/template`) and are never checked in here.

### Current state

- Exists: `apps/api` (NestJS 12 on Fastify, Drizzle; catalog, play info, SDK registry),
  `apps/shell` (Nuxt 4; catalog, detail, play page with runtime adapter loading),
  `apps/adapters` (v1), `packages/protocol`, `packages/sdk` (+ `/mock`), `packages/cli`
  (validate/publish), accounts (Logto/OIDC, admin by role), Dockerfiles, `infra/compose.yml`.
  `apps/rooms` (shared WebSocket relay; game tokens from the API's JWKS), Tier 2 game
  server approval with API-generated compose fragments (`games-net`), SDK lifecycle
  automation (date-driven status, hourly sync, GitHub notices), developer dashboard (`/dev`),
  per-subject rate limits, score trust policy (server keys), backups and health alerts
  (`infra/ops`). Security model: `docs/security.md`.
- The game template ships as `packages/create-game` (`npm create @croffledev/play-game`); its
  tests build and validate a generated game against the workspace SDK.
- Game domain edge: `infra/nginx/templates/game-domain.conf.template` (nginx in front of
  storage; rules in `infra/README.md`). Shell CSP origins come from `NUXT_CSP_*`.
- `pnpm dev:games` serves fixture games (`apps/shell/dev/games`) and adapter bundles on
  `:4100`, a separate origin like production.
- API tests run the real migrations on in-memory PGlite; `DATABASE_URL=pglite://memory` also runs
  the API locally without Docker (development only).
- Remote: `team-croffle/croffle-play` (public). `master` is protected by a ruleset: PRs only,
  rebase merge, required checks `CI result`, `TruffleHog`, `Gitleaks`.
- `docs/ARCHITECTURE.md` is the design record (Korean); `docs/ROADMAP.md`
  the public roadmap. `README.md` describes the _target_ product.
- Game asset domain `croffle-play.link` is registered (Cloudflare). Platform domain:
  `play.croffledev.kr` (code reads it from env only).

### Planned layout

| Path                   | Package                        | Ships as                     |
| ---------------------- | ------------------------------ | ---------------------------- |
| `apps/shell`           | `@croffledev/play-shell`       | Docker image (GHCR), private |
| `apps/api`             | `@croffledev/play-api`         | Docker image (GHCR), private |
| `apps/rooms`           | `@croffledev/play-rooms`       | Docker image (GHCR), private |
| `apps/adapters`        | `@croffledev/play-adapters`    | Static bundles → storage     |
| `packages/protocol`    | `@croffledev/play-protocol`    | npm                          |
| `packages/sdk`         | `@croffledev/play-sdk`         | npm                          |
| `packages/cli`         | `@croffledev/play-cli`         | npm                          |
| `packages/create-game` | `@croffledev/create-play-game` | npm (`npm create`)           |
| `infra/`               | —                              | Compose, nginx, env examples |

`apps/*` are `"private": true`. Workspace packages export a
`"@croffledev/source"` condition pointing at `src/`; `tsconfig.base.json`
(`customConditions`) and each vitest config resolve it, so packages typecheck
and test against each other's source without a build. Builds use `dist`.

### Stack

- Node ≥ 24, pnpm (Corepack, version pinned in `package.json`), TypeScript.
- Shell: Nuxt (SSR for catalog/detail pages). API: NestJS on Fastify. Rooms: custom
  WebSocket server (`ws`, relay only).
- Data: PostgreSQL via Drizzle (migrations in `apps/api/drizzle`). Storage: **S3 API
  only** (MinIO on the home server now; R2/S3 later without code changes).
- Validation: valibot (env, protocol messages, manifests). Identity: Logto (OIDC).
- Edge: Cloudflare in front (DNS, cache, Tunnel), Traefik on the server, nginx
  for the game domain mapping (`<id>.croffle-play.link/<ver>/` →
  `games/<id>/<ver>/`).
- Quality: oxlint (`.oxlintrc.json`), oxfmt (`.oxfmtrc.json`), lefthook
  (`lefthook.yml`), Changesets for `packages/*`.

### Commands

Run from the repo root.

```bash
pnpm install                 # also installs git hooks (lefthook)
pnpm check                   # completion gate: secret-files, format, lint, typecheck, test, build
pnpm format / pnpm lint:fix  # rewrite
pnpm format:check / pnpm lint / pnpm typecheck / pnpm test / pnpm build

pnpm dev:shell               # apps/shell  (once it exists)
pnpm dev:api                 # apps/api
pnpm --filter <pkg> <script> # single package

pnpm changeset               # after changing packages/*
```

Hooks: `pre-commit` (secret files, oxfmt + restage, oxlint, typecheck),
`commit-msg` (`scripts/hooks/check-commit-msg.sh`), `pre-push` (tests).
Never bypass with `--no-verify`; fix the cause. `pnpm check` is the same gate
CI runs.

### Versioning

- **Platform (`apps/*`)**: git tags `vX.Y.Z` / `vX.Y.Z-rc.N` are the source
  of truth; nothing in the tree is bumped. The release workflow builds one
  image per app (`ghcr.io/team-croffle/croffle-play/<app>:<version>`).
- **Packages (`packages/*`)**: independent semver via Changesets, published
  to npm by the `Publish Packages` workflow through npm trusted publishing
  (OIDC). No npm token exists in the repository or its secrets; never add one.
  Never publish by hand (the one-time `0.0.0` name placeholders excepted).
- **SDK majors** are the platform's public contract and have their own
  lifecycle (`current → lts → maintenance → deprecated → eol`) stored in the
  database, not in code. See _Design invariants_ 5–6.

### Design invariants

Changing any of these requires a decision entry in `.ai/history/`.

1. **The shell never embeds game code.** Every game runs in an `iframe` from
   `https://<id>.croffle-play.link/<version>/`. Shell bundle size and deploy
   frequency are independent of the number of games. Games are registered
   through the API and storage, never through a shell release.
2. **Game bundles are immutable.** `games/<id>/<version>/` is written once;
   re-uploading an existing version is refused by the API. What users see is
   a database pointer (`stable_version`, `preview_version`); rollback is a
   pointer move. Objects are served with `immutable` cache headers.
3. **Bundles are self-contained.** Relative paths only, no external resources
   (CSP-enforced), no cookies (`Set-Cookie` is stripped at the edge),
   `frame-ancestors` limited to the platform origin. One registered domain
   per concern: the game domain is never a subdomain of the platform domain.
4. **Authentication lives in the shell only.** A game never holds a platform
   session. Tier 1 (default): the SDK proxies score/save calls through the
   shell via `postMessage`; the game sees only a public profile. Tier 2
   (approval only): a short-lived JWT with `aud: game:<id>` delivered by
   `postMessage` — never in a query string — and verified by the game server
   against the platform JWKS.
5. **The handshake is the only frozen protocol.** `__hello { sdk, game }` /
   `__welcome { capabilities }` never changes. Everything else is versioned
   by SDK major; a game is pinned to the SDK it was built with. Minor
   features are discovered via capabilities, never by version comparison.
6. **One host adapter per SDK major, loaded at runtime** from storage with
   SRI verification. The shell core exposes only `identity`, `api()`, `ui`,
   `lifecycle`. A new SDK feature is an API endpoint plus an adapter
   release — not a shell release. `deprecated` SDK majors cannot publish new
   game versions; `eol` majors cannot be played.
7. **Game servers are untrusted tenants.** They join `games-net` only — never
   the database or Redis networks — talk to the platform through the public
   API, verify tokens via JWKS, and run with CPU/memory limits,
   `read_only`, `cap_drop: ALL`. Default multiplayer is the shared rooms
   server; per-game authoritative servers are approval-only.
8. **Storage through the S3 API only**, with per-game deploy keys and
   presigned URLs scoped to one version path. No admin storage credentials
   leave the platform.
9. **Monorepo for the platform, one repository per game.** Game engines,
   build tools, and release cadence are the game author's choice; the
   platform constrains only the bundle contract (`game.json`, entry,
   thumbnail, size limit, SDK range).

### Domain notes

- `game.json` manifest: `id`, `name`, `version`, `entry`, `thumbnail`, `sdk`
  (semver range), `needsServer`, `orientation`, optional `server.protocol`.
- Reserved game ids / subdomains: `www`, `api`, `admin`, `cdn`, `play`,
  `rooms`, `auth`, `static`, `preview`, `srv` (`RESERVED_GAME_IDS` in
  `packages/protocol`; game servers live at `<id>.srv.<game domain>`).
- Publish flow: tag push → CI builds → `play-cli validate` →
  `POST /games/:id/versions` (refused when the SDK major is deprecated/eol) →
  presigned uploads → `…/complete` (hash + file list check) → `preview`
  pointer → admin approval → `stable` pointer.
- Rooms (WebSocket): auth as the **first message** after connect, `Origin`
  check against the game domain, 30 s ping, exponential-backoff reconnect
  with room re-join handled inside the SDK.
- Shell routes: `/game/:id` (SSR detail), `/game/:id/play` (iframe),
  `/game/:id/play?version=` (admin preview), `/admin/games/:id/versions/:v`.

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
  `api`, `rooms`, `adapters`, `protocol`, `sdk`, `cli`, `create-game`, `infra`,
  `ci`, `docs` (omit when repo-wide). Human-facing version of these rules:
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
- Shell (Nuxt): no game-specific code, no per-game branches. Anything a game
  needs goes through the protocol → adapter → API path.
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
