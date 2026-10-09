---
name: release-prod
description: Stable release `vX.Y.Z` — only on the user's explicit request. Runs the Release workflow (moves `latest` and `X.Y` on GHCR), publishes notes, closes the roadmap version.
argument-hint: '<line> <X.Y.Z> [--dry-run]'
disable-model-invocation: true
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Arguments: $ARGUMENTS — `<line> X.Y.Z`. Both are required; the version has no `-rc` suffix.

1. If the user has not asked for this stable release in this conversation,
   stop and say so.
2. Check the GitHub prerequisites and the **Stable release** preconditions;
   stop with the unmet list. If the tag already exists, say it is already
   released and stop.
3. Show the plan (line, version, rcs it includes, image tags `X.Y.Z`, `X.Y`,
   `latest` for that app) and ask for confirmation before triggering. With
   `--dry-run`, run `dry_run=true` without asking.
4. Run the workflow with `-f app=<line> -f version=X.Y.Z`, watch it, write
   `.ai/release/<line>-X.Y.Z_Release.md` from the stable template, publish
   with `--draft=false --latest`, verify.
5. Mark the version released in `ROADMAP.<line>.local.md` (in place), update
   `.ai/README.md`, write a history entry.

Report: tag, run URL, image references, release URL.

Not yet decided: deployment beyond GHCR (server pull, Compose on the host).
Ask before adding any deploy step.
