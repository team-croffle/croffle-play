---
name: plan-to
description: Plan every unplanned roadmap version up to a target version (inclusive). Use for "<버전>까지 계획".
argument-hint: <version>
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Target: $ARGUMENTS (required, e.g. `0.3` or `0.3.0`; an rc suffix is ignored
for planning).

1. If the argument is missing or no roadmap heading matches, list the roadmap
   versions and stop.
2. Walk roadmap versions in semver order from the next version up to the
   target. For each without a plan, run the `/plan-next` steps. Skip versions
   that already have a plan and say so.
3. Later versions may depend on earlier items: write them as
   `"<version>_<N>"` in the 의존 column.

Report one table per version plus open `[ask user]` decisions. Do not create
work files, implement, or commit.
