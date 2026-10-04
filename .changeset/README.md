# Changesets

`packages/*` (`@croffledev/play-protocol`, `play-sdk`, `play-cli`) are versioned and published
with [Changesets](https://github.com/changesets/changesets). Every change to a publishable package
ships with a changeset in the same PR: `pnpm changeset`.

`apps/*` are `"private": true` and therefore never versioned here (`privatePackages.version: false`);
their version is the git tag (see `AGENTS.md` → Versioning).
