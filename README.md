# Croffle Play

A web game platform by [Team Croffle](https://github.com/team-croffle). Team members build games in
their own repositories — any engine — and publish them here. The platform provides the catalog, one
shared account, scores and saves, multiplayer rooms, and the SDK games talk to.

[한국어](./README.ko.md)

> Status: **early development.** The API and shell skeletons exist; the SDK, publishing, and
> multiplayer follow the [roadmap](./docs/ROADMAP.md). Design record:
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

| Path                | Package                     | Ships as       |
| ------------------- | --------------------------- | -------------- |
| `apps/shell`        | `@croffledev/play-shell`    | Docker image   |
| `apps/api`          | `@croffledev/play-api`      | Docker image   |
| `apps/rooms`        | `@croffledev/play-rooms`    | Docker image   |
| `apps/adapters`     | `@croffledev/play-adapters` | Static bundles |
| `packages/protocol` | `@croffledev/play-protocol` | npm            |
| `packages/sdk`      | `@croffledev/play-sdk`      | npm            |
| `packages/cli`      | `@croffledev/play-cli`      | npm            |

Games are **not** in this repository. They are created from the game template repository and
published with `play-cli`.

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

Full stack in containers (PostgreSQL, MinIO, API, shell):

```bash
cp infra/.env.example infra/.env         # replace the CHANGE_ME values
docker compose -f infra/compose.yml --env-file infra/.env up --build
```

Contribution rules for humans and agents: [AGENTS.md](./AGENTS.md).

## License

MIT
