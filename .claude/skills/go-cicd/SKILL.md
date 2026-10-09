---
name: go-cicd
description: Publish the current rc branch end to end — /go-ci (PR, checks, merge) then /release for that rc. Stops before any stable release.
argument-hint: '[<line>-X.Y.Z-rc.A …]'
disable-model-invocation: true
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

rcs: $ARGUMENTS (one or more `<line>-X.Y.Z-rc.A`), otherwise the `release`
values of the items on this branch (from their history files / the plan). A
branch may ship several lines; order them api → games/rooms → shell. A
`packages` release value needs no `/release` (Changesets publishes on
merge) — just note the pending "chore: version packages" PR.

1. Run the `/go-ci` steps.
2. Run the `/release` steps for each rc in that order.
3. Update the plan rows (`상태`) and `.ai/README.md` 현재 위치.

Report: PR URL, merge commit, tag, run URL, release URL, what comes next
(next rc or the version is rc-complete).
