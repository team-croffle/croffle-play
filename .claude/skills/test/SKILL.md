---
name: test
description: Run the test workflow (gates, smoke, scenarios) on the current state and write `.ai/test/<YYYY-MM-DD-HHmm>_<version>.md`. Failures become work items; nothing is fixed here.
argument-hint: '[<line>-<version>]'
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Under test: $ARGUMENTS as `<line>-<version>`, otherwise the current work
version of the line implied by the current branch (its work files or history
entries), otherwise ask which line. The report is
`.ai/test/<stamp>_<line>-<version>.md`; a branch spanning several lines gets
one report per line.

Run the **Test workflow** exactly. Report the gates table and the scenario
table, every failure with file paths, the work items created for failures, and
every scenario left for the user. Do not fix anything and do not commit.
