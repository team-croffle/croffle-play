---
name: go-cicd
description: Publish the current rc branch end to end — /go-ci (PR, checks, merge) then /release for that rc. Stops before any stable release.
argument-hint: '[X.Y.Z-rc.A]'
disable-model-invocation: true
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

rc: $ARGUMENTS, otherwise the `release` value shared by the items on this
branch (from their history files / the plan). If the branch's items point at
more than one rc, stop and ask which one ships.

1. Run the `/go-ci` steps.
2. Run the `/release` steps for the rc.
3. Update the plan rows (`상태`) and `.ai/README.md` 현재 위치.

Report: PR URL, merge commit, tag, run URL, release URL, what comes next
(next rc or the version is rc-complete).
