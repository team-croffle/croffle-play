---
name: gen-pr
description: Draft the PR title and body for the current branch into `.ai/pr/<branch>.md` from the PR template, commits, history, and test report. Does not push.
argument-hint: '[base, default master]'
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Base: $ARGUMENTS or `master`.

1. Refuse on `master`. Collect `git log <base>..HEAD`, the history files of the
   items on this branch, the plan's release memo, and the latest
   `.ai/test/*_<version>.md`.
2. Pick the template under `.github/pull_request_template/` by the branch
   prefix (`feat/` → feature, `fix/` → bug fix, otherwise default).
3. Write `.ai/pr/<branch>.md`:
   - First line `title: <type(scope): title>` (≤72 chars, English), blank
     line, then the body following the template section by section.
   - Summary: behaviour, not a file list. Release: the rc label. Test plan:
     tick only what was actually run (from the test report).
   - Design invariants: tick "changed" only with the decision keyword.
   - SDK contract: tick the matching line when `packages/protocol`,
     `packages/sdk`, or `apps/adapters` changed; a breaking change names the
     new major and the migration note.
   - English. No `.ai/` content beyond what the template asks, no internal
     status, names, or schedules.
4. If no test report covers the branch HEAD, say `/test` should run first.
   If `packages/*` changed without a changeset, say so.

Show the draft. Publishing is `/go-ci`.
