---
name: plan-to
description: Plan every unplanned roadmap version up to a target version (inclusive). Use for "<버전>까지 계획".
argument-hint: <line> <version>
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Target: $ARGUMENTS — `<line> <version>` (required, e.g. `api 0.15` or
`shell 0.15.0`; an rc suffix is ignored for planning).

1. If the line or version is missing, or no heading in
   `ROADMAP.<line>.local.md` matches, list that line's roadmap versions and
   stop.
2. Walk the line's roadmap versions in semver order from its next version up
   to the target. For each without a plan, run the `/plan-next <line>` steps.
   Skip versions that already have a plan and say so.
3. Later versions may depend on earlier items: write them as
   `"<line>-<version>_<N>"` in the 의존 column.

Report one table per version plus open `[ask user]` decisions. Do not create
work files, implement, or commit.
