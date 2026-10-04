# Croffle Play

A web game platform by [Team Croffle](https://github.com/team-croffle). Team members build games in
their own repositories — any engine — and publish them here. The platform provides the catalog, one
shared account, scores and saves, multiplayer rooms, and the SDK games talk to.

[한국어](./README.ko.md)

> Status: **design stage.** This repository currently holds tooling, workflows, and the design
> record. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and
> [docs/ROADMAP.md](./docs/ROADMAP.md).

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
pnpm dev:shell      # once apps/shell exists
pnpm dev:api
```

Contribution rules for humans and agents: [AGENTS.md](./AGENTS.md).

## License

MIT
