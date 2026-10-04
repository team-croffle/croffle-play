---
name: gen-work
description: Generate `.ai/work/<version>_<N>_<slug>.md` files from a plan's work table. Use after /plan-next or /plan-to, or when plan rows were added.
argument-hint: '[version]'
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Version: $ARGUMENTS, otherwise the lowest planned version whose plan is not
`done`.

1. If the version has no plan, say so (`/plan-next` or `/plan-to <version>`
   creates it) and stop.
2. For each plan row that is not finished and has no work file (and no history
   file for that number), write the work file from the template: re-read the
   code the row touches and fill **현재 코드** with real paths and facts, a
   file-level checklist, expected result, pitfalls, verification. Carry
   `release`, `depends`, `area`, `branch` from the plan. Add a checklist line
   `pnpm changeset` when the row touches `packages/*`.
3. Rows whose decisions are still `[ask user]` get `status: blocked` and the
   question in **결정**.
4. Set the plan `상태: in-progress` once any work file exists.

Report: created files (#, title, rc, status), blocked items and why. Do not
implement or commit.
