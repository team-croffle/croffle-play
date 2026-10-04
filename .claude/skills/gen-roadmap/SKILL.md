---
name: gen-roadmap
description: Add content or plans to the internal roadmap `.ai/ROADMAP.local.md` — place items under the right version, or add a version. Use when the user wants to put a feature, idea, or change into the roadmap.
argument-hint: <what to add>
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Request: $ARGUMENTS (required; if empty, ask what to add and stop).

1. Read `.ai/ROADMAP.local.md`, the latest tags (`git tag --list 'v*'`), and
   existing plans under `.ai/plan/`.
2. Decide placement:
   - Fits an unplanned version's theme → add bullets there.
   - Belongs to a version that already has a plan → add bullets to the
     roadmap **and** note in the report that `/plan-next` or `/gen-work` must
     pick them up (do not edit the plan silently).
   - Bug fix or small follow-up to a released version → a patch heading
     (`### vX.Y.Z`) right after its minor version.
   - New theme → a new `### vX.Y — <title>` in semver order, same format as
     the others (bullets, `기대 결과`, `예상 이슈`).
   - A protocol/SDK breaking change → goes under the version that introduces
     the next SDK major; say so explicitly in the bullet.
3. Check every new bullet against the AGENTS.md design invariants. A
   conflicting item is written with `[결정 필요]` and listed as an open
   question; do not reword it into compliance.
4. Update `## 열린 질문 / 결정 대기` if the addition raises one.
5. `docs/ROADMAP.md` (public) changes only when a phase-level item changes,
   and only without internal status, names, or schedules. Show the diff and do
   not commit it.

Report: where each item went and why, open questions. Do not commit.
