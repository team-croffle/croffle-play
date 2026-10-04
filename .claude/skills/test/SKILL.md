---
name: test
description: Run the test workflow (gates, smoke, scenarios) on the current state and write `.ai/test/<YYYY-MM-DD-HHmm>_<version>.md`. Failures become work items; nothing is fixed here.
argument-hint: '[version]'
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Version under test: $ARGUMENTS, otherwise the current work version (or the
version of the rc on the current branch), otherwise the released version.

Run the **Test workflow** exactly. Report the gates table and the scenario
table, every failure with file paths, the work items created for failures, and
every scenario left for the user. Do not fix anything and do not commit.
