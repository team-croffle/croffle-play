# Changesets

`packages/*` (`@croffledev/play-protocol`, `play-sdk`, `play-cli`, `create-play-game`) are versioned and published
with [Changesets](https://github.com/changesets/changesets). Every change to a publishable package
ships with a changeset in the same PR: `pnpm changeset`.

`play-sdk`'s major is the SDK major: games announce it in `__hello`, and the platform plays them only
with a registered adapter (`apps/adapters/v<major>`). A `major` bump of `play-sdk` is a new SDK major
and needs that adapter first; `scripts/publish-packages.mjs` refuses to publish without it.

`apps/*` are `"private": true` and therefore never versioned here (`privatePackages.version: false`);
their version is the git tag (see `AGENTS.md` → Versioning).
