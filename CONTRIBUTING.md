# Contributing to Croffle Play

Thanks for helping build the platform. This repository is the **platform** — shell, API, rooms
server, host adapters, and the packages games use. It is operated in production, so every change
goes through review and the same checks as CI.

[한국어](./CONTRIBUTING.ko.md)

## Where things go

| You want to…                       | Go to                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Make a game                        | Your own repository: `npm create @croffledev/play-game <dir>`. Games are never added here. |
| Host or register a game            | [docs/game-hosting.md](./docs/game-hosting.md) (an admin registers the id)                 |
| Report a bug or ask a question     | [Issues](https://github.com/team-croffle/croffle-play/issues/new/choose)                   |
| Propose a feature or an SDK change | A feature request issue first, before any code                                             |
| Report a security problem          | **Privately** — see [SECURITY.md](./SECURITY.md), never a public issue                     |

## Setup

Requires Node ≥ 24 and pnpm through Corepack (`corepack enable`; the version is pinned in
`package.json`).

```bash
pnpm install   # dependencies and git hooks (lefthook)
pnpm check     # secret files · format · lint · typecheck · test · build — the CI gate
```

Running the platform locally (no Docker needed: embedded PostgreSQL, a local OpenID provider,
fixture games) is described in the [README](./README.md#development).

## Making a change

1. **Start from an issue** for anything beyond a small fix, so the approach is agreed first.
2. **Branch** from `master` as `type/topic` (e.g. `feat/leaderboard-paging`, `fix/rooms-reconnect`).
   Never commit to `master`; it only changes through pull requests.
3. **Commit** in focused steps, using the format the `commit-msg` hook enforces:

   ```
   type(scope): title in the imperative, ≤ 72 characters

   One-line summary of why.

   - details as bullets
   ```

   Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`, `ci`, `style`,
   `revert`, `release`. Scopes: `shell`, `api`, `rooms`, `adapters`, `protocol`, `sdk`, `cli`,
   `create-game`, `ci`, `docs` (omit for repository-wide changes).

4. **Keep the hooks on.** They format, lint, typecheck, and scan for secret files. Never use
   `--no-verify`; fix the cause instead.
5. **Test** what you change. API tests run the real migrations on an in-memory PostgreSQL
   (PGlite); add the test next to the behaviour. For UI or cross-service changes, describe the
   manual scenario you ran in the PR.
6. **Packages** (`packages/*`): add a changeset (`pnpm changeset`) in the same pull request. Never
   publish by hand — the _Publish Packages_ workflow does it after merge.
7. **Open a pull request** with one of the templates (default, bug fix, feature). Fill in the
   _Design invariants_ and _SDK contract_ sections when they apply.

## Review and merge

- Required checks: **CI result**, **TruffleHog**, **Gitleaks**. A red check is never merged.
- Code owners (`.github/CODEOWNERS`) are requested for review automatically; resolve every
  review thread before merging.
- **Rebase and merge** only; history on `master` stays linear. Keep your branch rebased on
  `master` rather than merging it in.
- Releases are cut from `master` by maintainers (git tags `vX.Y.Z-rc.N` → `vX.Y.Z`). Deploying
  and operating the platform is outside this repository.

## Rules that need extra care

- **Design invariants** (in [AGENTS.md](./AGENTS.md)) — the portal never embeds game code, games
  are hosted by their teams, authentication lives in the portal only, game servers are untrusted, storage goes
  through the S3 API only, and the rest. Changing one needs an issue, a decision recorded in
  [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), and a maintainer's approval.
- **The SDK protocol is a public contract.** The `__hello` / `__welcome` handshake never changes.
  New messages are additive and come with a capability; renaming or removing anything is a new SDK
  major with a host adapter and a migration. Every message is defined once, in
  `packages/protocol`.
- **No game-specific code** in the shell or API. What a game needs goes through
  protocol → adapter → API.
- **Secrets** never enter the repository: `.env*` files stay local, `*.example` files document the
  variables, and the hooks and CI scan every push.

## Writing

Code, commit messages, pull requests, and release notes are in English. `README.md` and
`CONTRIBUTING.md` have Korean versions next to them; documents under `docs/` are in Korean.
Formatting is owned by oxfmt — run `pnpm format` instead of formatting by hand.

## License

By contributing you agree that your contributions are licensed under the [MIT License](./LICENSE).
