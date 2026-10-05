# Croffle Play

A web game platform by [Team Croffle](https://github.com/team-croffle). Team members build games in
their own repositories — any engine — and publish them here. The platform provides the catalog, one
shared account, scores and saves, multiplayer rooms, and the SDK games talk to.

[한국어](./README.ko.md)

> Status: **pre-release.** Catalog, play page, SDK v1, runtime host adapters, the publish
> pipeline (play-cli → review → approval), accounts (sign-in, scores, leaderboards, saves), and
> multiplayer rooms work; see the [roadmap](./docs/ROADMAP.md). Design record:
> [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## How it fits together

```
Shell (Nuxt)  ──  catalog · login · play page
   │ iframe      https://<game>.croffle-play.link/<version>/
Game bundle   ──  built by its author, immutable per version
   │ postMessage (SDK protocol, pinned at build time)
Host adapter  ──  one per SDK major, loaded at runtime
   │
Shell core  ──►  API (NestJS)  ──►  PostgreSQL · S3 storage
```

- The shell never embeds game code, so it does not grow with the number of games.
- Each game version is an immutable static bundle on its own subdomain; what is live is a pointer.
- Games are pinned to the SDK version they were built with. New SDK versions ship as adapters, not
  shell releases. Old majors move through `lts → deprecated → eol` on a published schedule.
- Login happens in the shell only; games receive identity through the SDK.

## Repository layout (planned)

| Path                   | Package                        | Ships as           |
| ---------------------- | ------------------------------ | ------------------ |
| `apps/shell`           | `@croffledev/play-shell`       | Docker image       |
| `apps/api`             | `@croffledev/play-api`         | Docker image       |
| `apps/rooms`           | `@croffledev/play-rooms`       | Docker image       |
| `apps/adapters`        | `@croffledev/play-adapters`    | Static bundles     |
| `packages/protocol`    | `@croffledev/play-protocol`    | npm                |
| `packages/sdk`         | `@croffledev/play-sdk`         | npm                |
| `packages/cli`         | `@croffledev/play-cli`         | npm                |
| `packages/create-game` | `@croffledev/create-play-game` | npm (`npm create`) |

Games are **not** in this repository. Each game gets its own repository, created with
`npm create @croffledev/play-game <dir>` and published with `play-cli`.

## Development

Requires Node ≥ 24 and pnpm (Corepack).

```bash
pnpm install        # installs dependencies and git hooks
pnpm check          # secret-files · format · lint · typecheck · test · build
```

Run the API and shell locally. Without Docker, the API can use an embedded Postgres (PGlite) with a
dummy catalog:

```bash
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL=pglite://memory and DB_SEED=true
pnpm dev:api                             # http://localhost:3001 (/healthz, /v1/games)
pnpm dev:shell                           # http://localhost:3000
```

Full stack in containers (PostgreSQL, MinIO, game-domain edge, API, shell); deployment details in
[infra/README.md](./infra/README.md):

```bash
cp infra/.env.example infra/.env         # replace the CHANGE_ME values
docker compose -f infra/compose.yml --env-file infra/.env up --build
```

Play a game locally (the `sample` fixture, served on its own origin like a real game):

```bash
pnpm dev:games    # builds fixtures + host adapters, serves http://localhost:4100
# apps/api/.env: GAME_URL_TEMPLATE=http://{id}.localhost:4100/{version}/
#                SEED_ADAPTER_MANIFEST_URL=http://localhost:4100/adapters/v1/dev/manifest.json
pnpm dev:api && pnpm dev:shell    # open http://localhost:3000/game/sample/play
```

Sign-in locally: `pnpm dev:oidc` starts a stand-in OpenID provider on `:4300` (any login name). Set the
OIDC variables from `apps/api/.env.example` and `apps/shell/.env.example`; `ADMIN_SUBS=admin` makes the
login name `admin` an admin.

## Building a game

Games bundle [`@croffledev/play-sdk`](./packages/sdk) and talk to the platform only through it:

```ts
import { createSdk } from '@croffledev/play-sdk';

const sdk = await createSdk({ game: 'tetris' });
await sdk.ready();
if (sdk.has('score')) await sdk.submitScore(1200);
```

Outside the platform, pass `transport: createMockHost()` from `@croffledev/play-sdk/mock` to run the
game on its own. Publishing (deploy keys, `play-cli`, review and approval):
[docs/publishing.md](./docs/publishing.md). Multiplayer rooms: [docs/multiplayer.md](./docs/multiplayer.md). Games with their own server:
[docs/game-servers.md](./docs/game-servers.md). SDK versions and upgrades:
[docs/sdk-lifecycle.md](./docs/sdk-lifecycle.md). Operating the platform:
[docs/operations.md](./docs/operations.md), [docs/security.md](./docs/security.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) (workflow, commit format, review) and
[AGENTS.md](./AGENTS.md) (design invariants, conventions — also read by AI agents). Security issues:
[SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © Croffle Dev. (Team Croffle)
