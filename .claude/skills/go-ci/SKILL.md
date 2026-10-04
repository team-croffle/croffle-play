---
name: go-ci
description: Publish the current branch — draft the PR, push, create it, wait for CI and secret scans, fix red checks, and Rebase-and-Merge into master. No release.
argument-hint: '[PR number to resume]'
disable-model-invocation: true
---

Read `.claude/skills/play-workflow/SKILL.md` first and follow it.

Argument: $ARGUMENTS — an existing PR number to resume from step 4.

1. Check the GitHub prerequisites. Refuse on `master` or with a dirty tree.
2. If no test report covers HEAD, run the `/test` steps; a failing gate stops
   here.
3. Run the `/gen-pr` steps if `.ai/pr/<branch>.md` is missing or older than
   HEAD.
4. Run **PR → checks → merge**: sync, push, `gh pr create`, watch checks, fix
   red ones on the branch (normal commits, never `--no-verify`, never force
   push after the PR is open unless the user agrees), merge with
   `--rebase --delete-branch`, sync master, delete the local branch.
5. Write a short history entry for the merge (PR URL, fixes made for red
   checks; first line `decisions: …`). Mention a pending "chore: version
   packages" PR if the bot opened one.

Report: PR URL, checks, merge commit, and anything left for the user.
