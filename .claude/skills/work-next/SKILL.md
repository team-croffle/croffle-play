---
name: work-next
description: Do the next pending work item (lowest number whose dependencies are finished) of the current work version, then stop. Use for "다음 작업", "work next".
argument-hint: '[N]'
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Optional item number: $ARGUMENTS

1. Find the current work version and its first `status: todo` work file whose
   dependencies are finished, lowest number first (or item `N`).
   - No work file at all: say the next version needs `/plan-next` +
     `/gen-work` and stop.
   - Everything left is blocked: list the blockers and stop.
2. Say which item you are taking, then run the **Work workflow** for it.
3. Stop after this one item. If it finished the last item of its rc, say the
   rc is ready for `/test` and `/go-ci` or `/go-cicd`.

Report: item, branch, commit hash, gate result, anything left for the user.
