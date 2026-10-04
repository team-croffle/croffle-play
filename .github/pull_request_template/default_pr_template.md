## Summary

<!-- 1–3 bullets: what changed and why (not a file list). -->

-

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor / cleanup
- [ ] Chore (tooling, CI, deps)
- [ ] Docs
- [ ] Breaking change (explain below)

## Scope

<!-- Check all that apply. Prefer small, package-focused PRs. -->

- [ ] `apps/shell`
- [ ] `apps/api`
- [ ] `apps/rooms`
- [ ] `apps/adapters`
- [ ] `packages/protocol` (publishable)
- [ ] `packages/sdk` (publishable)
- [ ] `packages/cli` (publishable)
- [ ] `infra/` / root / CI

## Release

<!-- Target pre-release, e.g. v0.1.0-rc.1, or "none". -->

Target:

## Related issues

<!-- Fixes #123 / Relates to #456 — or "N/A" -->

-

## Changes

-

## Design invariants

<!-- AGENTS.md "Design invariants". Changing one needs a recorded decision. -->

- [ ] No invariant changed
- [ ] Invariant changed — decision recorded: <!-- keyword -->

## SDK contract

<!-- Required when packages/protocol, packages/sdk, or apps/adapters change. -->

- [ ] No protocol/SDK message changed
- [ ] Additive change (new capability) — adapter updated
- [ ] Breaking change — new SDK major, migration noted below

## Test plan

- [ ] `pnpm check` passes
- [ ] Docker image builds (if an `apps/*/Dockerfile` or its inputs changed)
- [ ] Changeset added (if `packages/*` changed)
- [ ] Manual scenario: <!-- e.g. open /game/<id>/play, handshake logged -->

## Notes for reviewers

-
