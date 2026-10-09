---
name: workflow
description: Take a goal in plain words, judge what it needs, update the roadmap if necessary, and run /work-cicd-to up to the point that delivers it. Runs /release-prod only when the request explicitly asks for a stable release.
argument-hint: <context — what should be done, and how far>
disable-model-invocation: true
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Context: $ARGUMENTS (required; if empty, ask what to do and stop).

1. **Understand.** Read `.ai/README.md`, `.ai/ROADMAP.local.md` and the
   `ROADMAP.<line>.local.md` files the context touches, plans, open work
   files, tags, `docs/ARCHITECTURE.md` where relevant, and the history
   decisions related to the context
   (`grep -l 'decisions:.*<keyword>' .ai/history/*`).
2. **Judge.** Decide what the context needs:
   - Already covered by roadmap + plans → no roadmap change.
   - Not covered, or covered in the wrong place → run the `/gen-roadmap` steps.
     If the affected version already has a plan, add rows with the next free
     numbers and target rcs, then `/gen-work`.
   - Conflicts with a design invariant, needs a new SDK major, or needs an
     `[ask user]` decision → stop and ask before changing anything.
3. **Pick the target.** An explicit line, version or rc in the context wins.
   Otherwise the line the behaviour lives in and the earliest rc in which it
   ships; a change that spans lines targets the api rc and lists the others. State the
   decision and why in one short block (roadmap changes, target, rc run
   order), then continue.
4. **Execute.** Run the `/work-cicd-to <line>-<target>` steps.
5. **Stable release** only if the context explicitly asks for it (e.g. "정식
   배포까지", "release-prod"). It still needs the user's confirmation of the
   last rc: if the context does not say rc confirmation can be skipped, stop
   after the last rc and ask. Then run the `/release-prod` steps.
6. Write a history entry for the run (first line `decisions: …` with the
   judgement keywords) and update `.ai/README.md` 현재 위치.

Report: what was judged and changed in the roadmap, rcs shipped (PR, tag,
release URL), stable release if any, where and why it stopped.
