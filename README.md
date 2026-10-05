# Croffle Play

A web game platform by [Team Croffle](https://github.com/team-croffle). One account plays every
game: the portal provides sign-in, the catalog, scores and saves, multiplayer rooms, and the SDK
games talk to. Team members build games in their own repositories — any engine — and host them
themselves; the portal shows each game in an iframe.

[한국어](./README.ko.md)

> Status: **pre-release.** Portal (catalog, play page, player dashboard, admin and developer pages), SDK v1, runtime
> host adapters, game registration by `game.json`, accounts (sign-in, scores, leaderboards, saves),
> and multiplayer rooms work; see the [roadmap](./docs/ROADMAP.md). Design record:
> [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## How it fits together

```
Portal (Nuxt)  ──  catalog · sign-in · play page          www.croffle-play.link
   │ iframe       https://<game>.play.croffle-play.link/  (hosted by the game's team)
Game site      ──  serves game.json, lets the portal frame it
   │ postMessage (SDK protocol, pinned at build time)
Host adapter   ──  one per SDK major, picked from the game's handshake, loaded at runtime
   │
Portal core  ──►  API (NestJS)  ──►  PostgreSQL · S3 API (platform files)
```

- The portal never embeds game code, so it does not grow with the number of games.
- The platform stores no game files and tracks no game versions: a game is an id, a listing flag,
  and the `game.json` its own host serves.
- Games are pinned to the SDK version they were built with. New SDK versions ship as adapters, not
  portal releases. Old majors move through `lts → old → deprecated` on a published schedule.
- Sign-in happens in the portal only; games receive identity through the SDK.
- Deploying and operating the platform is outside this repository; the apps ship as images.

## Repository layout

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
`npm create @croffledev/play-game <dir>`.

## Development

Requires Node ≥ 24 and pnpm (Corepack).

```bash
pnpm install        # installs dependencies and git hooks
pnpm check          # secret-files · format · lint · typecheck · test · build
```

Play a game locally, without Docker (the API runs on an embedded Postgres with a dummy catalog, and
fixture games are served on their own origins like real games):

```bash
pnpm dev:games    # builds fixtures + host adapters, serves http://<id>.localhost:4100/
DATABASE_URL=pglite://memory DB_SEED=true \
  SEED_ADAPTER_MANIFEST_URL=http://localhost:4100/adapters/v1/dev/manifest.json pnpm dev:api
pnpm dev:shell    # open http://localhost:3000/game/sample/play
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
game on its own. Hosting and registering a game: [docs/game-hosting.md](./docs/game-hosting.md).
Multiplayer rooms: [docs/multiplayer.md](./docs/multiplayer.md). Games with their own server:
[docs/game-servers.md](./docs/game-servers.md). SDK versions and upgrades:
[docs/sdk-lifecycle.md](./docs/sdk-lifecycle.md). Security model:
[docs/security.md](./docs/security.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) (workflow, commit format, review) and
[AGENTS.md](./AGENTS.md) (design invariants, conventions — also read by AI agents). Security issues:
[SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © Croffle Dev. (Team Croffle)
