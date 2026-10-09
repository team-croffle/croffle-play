---
name: work-to
description: Run work items in order up to a target — a work number, `<version>_<N>`, an rc (`<version>-rc.A`), or a whole version — only if the plan and work files exist.
argument-hint: <N | line-version_N | line-version-rc.A | line-version>
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Target: $ARGUMENTS (required).

Resolve:

- `N` → items of the current work version (of the line implied by the
  branch; otherwise ask) up to and including `N`.
- `<line>-<version>_<N>` → the same for that line version.
- `<line>-<version>-rc.A` → every item whose `release` is that rc, plus
  unfinished dependencies (and every earlier rc's items of the same version).
- `<line>-<version>` → every item of that version and of the line's earlier
  unfinished versions.

If the argument is missing, the version has no plan, or the target item has no
work file (and no history file), say exactly what is missing and which skill
creates it (`/plan-to`, `/gen-work`), then **stop without doing any work**.

Run the **Work workflow** for each pending item in dependency order. Stop
early on a failed gate, a blocked item, or an open `[ask user]` decision, and
say where you stopped. Do not push.

Report: one row per item (#, commit, gate), where it stopped, what is next.
