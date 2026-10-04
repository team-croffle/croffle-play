---
name: plan-next
description: Plan the next roadmap version — write `.ai/plan/<version>_<slug>.md` with its work-item table. Use for "다음 버전 계획", "plan the next version".
argument-hint: '[hint]'
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Optional hint: $ARGUMENTS

1. `git fetch --tags` (skip if there is no remote). Determine the released
   version and the **next version**. If every roadmap version above the
   released one has a plan, say so and stop.
2. Read that roadmap section, `docs/ARCHITECTURE.md` where it applies, and
   the code it touches.
3. Write `.ai/plan/<version>_<slug>.md` with `상태: ready`: research, risks
   (design invariants), approach, decisions (`[ask user]`), numbered work
   table with a target `배포` rc per row, verification plan, release memo
   (including which `packages/*` need a Changeset). Group items into rcs that
   each make a testable PR.
4. Update `.ai/README.md` 현재 위치.

Report: version, work table (#, task, area, rc), open `[ask user]` decisions.
Do not create work files (that is `/gen-work`), implement, or commit.
