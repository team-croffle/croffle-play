---
name: work-cicd-to
description: Drive the roadmap up to a target pre-release — plan, gen-work, work-to, test, go-cicd for every rc from the current state to the target (e.g. 0.5.0 → 0.5.1-rc.7, 0.6.3 → 0.7.0-rc.4). Never does a stable release.
argument-hint: <line-X.Y.Z-rc.A | line-X.Y.Z>
disable-model-invocation: true
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Target: $ARGUMENTS (required): `<line>-X.Y.Z-rc.A` = up to and including
that rc of that line; `<line>-X.Y.Z` = every planned rc of that version
(still no stable release). The packages line has no rcs: a packages plan is
worked with `/work-to packages-<label>` and shipped by `/go-ci`.

## Resolve the range

1. `git fetch --tags`; released version `R` = the line's highest
   `<line>-v*` tag (none → `0.13.0`). If the target is not newer than `R`,
   say so and stop.
2. Versions in range = the line's roadmap versions with a core above `R`'s
   core (or equal to it when `R` is an rc) up to the target core, in semver
   order.
   - `R = api-0.14.0`, target `api-0.14.1-rc.7` → `0.14.1`, rc.1 … rc.7.
   - `R = api-0.14.3`, target `api-0.15.0-rc.4` → any `0.14.x` roadmap
     versions above `0.14.3` (all their rcs), then `0.15.0` rc.1 … rc.4.
   - `R = api-0.14.1-rc.3`, target `api-0.14.1-rc.7` → `0.14.1` rc.4 … rc.7.
3. If the target core has no heading in `ROADMAP.<line>.local.md`, stop:
   `/gen-roadmap` or `/workflow` adds it.
4. Run the `/plan-to <line>` steps for unplanned versions, then `/gen-work`
   for each version in range. Items of the plan that belong to another line
   (`release: shell-…` in an api plan) ship with their own line's rc in the
   same PR; `/go-cicd` releases each line.
5. Check the target rc exists among the final version's planned `release`
   values. If the plan has fewer rcs than the target, stop and report the
   plan's rcs; do not invent work to reach a number.
6. Show the run order (version → rc → items) once, then start.

## Loop — for each rc in order

1. `/work-to <line>-<version>-rc.A` steps.
2. `/test` steps. Failures become items of the same rc; work them and test
   again. After two failed rounds on the same rc, stop and report.
3. `/go-cicd <line>-<version>-rc.A` (and the other lines' rcs on the branch) steps.
4. Next rc. Intermediate versions end rc-complete; their stable release is
   left for `/release-prod` (list them in the report).

## Stop conditions

An open `[ask user]` decision, a blocked item, a design-invariant change
without a recorded decision, a protocol/SDK breaking change not planned as a
new major, two failed test rounds, a red check that the history has no fix
for after two attempts, or anything hard to undo (see the shared rules). Say
exactly where it stopped; rerunning the same command resumes from the current
state.

Report: per rc — items, PR, tag, release URL; then versions left rc-complete
and what is next.
