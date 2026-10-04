---
name: release
description: Release an rc (`vX.Y.Z-rc.A`) — run the Release GitHub workflow (one image per app to GHCR + draft pre-release), then publish notes. Pre-release only; stable is /release-prod.
argument-hint: '[X.Y.Z-rc.A] [--dry-run]'
disable-model-invocation: true
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Arguments: $ARGUMENTS. Version defaults to the `release` value of the most
recently merged items that has no tag yet. `--dry-run` → `dry_run=true`
(builds the images only; no notes, no history).

1. Refuse a version without `-rc.N`; point to `/release-prod`.
2. Check the GitHub prerequisites and the **Release workflow (rc)**
   preconditions. Stop with the list of unmet ones.
3. Run the **Release workflow (rc)**: trigger, watch, write notes, publish,
   verify.

Report: tag, run URL, image references, release URL.

Current state: the workflow pushes one image per `apps/*/Dockerfile` to GHCR
and creates a GitHub pre-release. Server deployment is manual (Compose pull +
restart). npm packages are released separately by `Publish Packages`.
