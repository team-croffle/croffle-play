---
name: play-workflow
description: Shared rules for the croffle-play `.ai/` loop — versions, roadmap/plan/work/test/history files, the work, test, PR, and release workflows. Every workflow skill (gen-roadmap, plan-*, gen-work, work-*, test, gen-pr, go-ci, go-cicd, release, release-prod, work-cicd-to, workflow) reads this first. Also read it when asked about plan or work files, "다음 작업", rc numbers, or release steps.
user-invocable: false
---

# Play workflow

Adds the loop to `AGENTS.md` (which wins on conflict) and the global
instructions. `.ai/` is gitignored and written in **Korean**; code, commit
messages, PRs, and release notes on GitHub are English unless a template says
otherwise. Nothing from `.ai/` is copied into committed files.

## Versions

Two version lines exist. The loop below tracks the **platform** line.

- **Platform (`apps/*`)**: git tags `vX.Y.Z` or `vX.Y.Z-rc.N` are the source
  of truth. Nothing in the tree holds the version; each Dockerfile gets it
  through the `VERSION` build arg. Order: `X.Y.Z-rc.1 < … < X.Y.Z`.
- **Packages (`packages/*`)**: independent semver via Changesets. A work item
  that touches a publishable package adds a changeset; the `Publish Packages`
  workflow versions and publishes after merge. Package versions never appear
  in roadmap headings.
- **SDK majors** (`packages/sdk` major = `apps/adapters/v<N>`) are tracked in
  the roadmap as features ("SDK v2"), their lifecycle in the database.
- **Released version**: highest platform tag after `git fetch --tags` (none →
  `0.0.0`). **Stable version**: highest tag without `-rc`.
- **Roadmap versions**: `### vX.Y` or `### vX.Y.Z` headings in
  `.ai/ROADMAP.local.md`. `vX.Y` means `X.Y.0`.
- **Next version**: first roadmap version (semver order) above the released
  core that has no plan file.
- **Current work version**: lowest version that still has a file under
  `.ai/work/` (work files are deleted when finished).
- File names carry versions without `v` (`0.1.0`, `0.1.0-rc.2`).
- Non-version plans (`plan/0_<slug>.md` and similar) are outside this loop.

## Work numbers vs. rc labels

- Work items of a version are numbered `1, 2, …` in execution order. Numbers
  continue across planning rounds and are never reused or renumbered.
- `release: X.Y.Z-rc.A` in each work file is the pre-release it ships in.
  Several items normally share one rc — enough for one PR worth testing. The
  target may move before shipping; update the work file and the plan table.
- Never write `rc.N` to mean a work item. In prose use `#N` (or `0.1.0#3`).
- One rc = one branch = one PR. Keep untagged rc labels contiguous: if a
  planned rc is merged into another, renumber the later `release` fields.

## `.ai/` layout

```
.ai/
  README.md                               layout + current position (session start)
  ROADMAP.local.md                        internal versioned roadmap (planning source)
  plan/<version>_<slug>.md                one plan per version
  work/<version>_<N>_<slug>.md            one item per file; deleted when finished
  history/<YYYY-MM-DD-HHmm>_<task>.md     first line `decisions: …` or `decisions: none`
  test/<YYYY-MM-DD-HHmm>_<version>.md     test run report
  pr/<branch>.md                          PR body draft
  release/<version>_<Release|Pre-Release>.md   GitHub release note body
```

## Plan file — `.ai/plan/<version>_<slug>.md`

```
# <version> 계획 — <주제>
기준: ROADMAP.local.md `### v<X.Y>` (갱신 <date>)
상태: draft | ready | in-progress | done
브랜치: feat/<version>-<slug>

## 목표
## 조사            로드맵 항목이 닿는 코드와 현재 사실 (파일 경로)
## 의존 / 위험      설계 불변식(AGENTS.md)과 충돌 여부를 반드시 적는다
## 접근            나누는 방법과 순서의 이유
## 결정            필요한 결정. 사용자 판단이 필요한 것은 `[ask user]`
## 작업 목록
| # | 작업 | 영역 | 의존 | 배포 | 상태 |
|---|---|---|---|---|---|
## 검증 계획        게이트 + 수동 시나리오 (curl, 브라우저)
## 릴리스 메모       rc 구성, 노트에 쓸 내용, Changeset 필요 여부, 공개 문서 갱신 위치
```

Rules: read the roadmap entry **and the code it touches** first; every roadmap
bullet maps to at least one item; one item = one focused commit (or a short
series); order by dependency — `protocol` before `sdk`/`adapters` before
`shell`, `api` schema before `api` routes before `shell` pages; areas are
`shell | api | rooms | adapters | protocol | sdk | cli | infra | ci | docs`;
end with a `docs` item when `README*.md` / `docs/` change. Items that change
`packages/*` note "Changeset" in 릴리스 메모.

## Work file — `.ai/work/<version>_<N>_<slug>.md`

```
---
version: <version>
id: <N>
release: <version>-rc.A
title: <제목>
area: <area>
depends: []          # [1, 2] same version, ["0.1.0_3"] other version
status: todo | doing | blocked
branch: feat/<version>-<slug>
---
## 목적
## 현재 코드          파일 경로 + 핵심 사실
## 작업              - [ ] 파일 단위 체크리스트
## 결정              - [ ] 필요한 결정, `[ask user]` 표시
## 기대 결과
## 예상 오류 / 주의
## 검증              - [ ] pnpm check  - [ ] 시나리오  - [ ] 사용자 확인 필요
```

## Work workflow (one item)

1. Refuse if `status: blocked`, a dependency's work file still exists, or an
   `[ask user]` decision is open — say why and stop.
2. Branch: never on `master`. Use the plan's branch; if it does not exist,
   create it from an up-to-date `master` (see Sync). Set `status: doing`.
3. Re-read **현재 코드**; if the plan no longer matches the code, fix the work
   file first. Check prior decisions:
   `grep -l 'decisions:.*<keyword>' .ai/history/*`.
4. Implement per `AGENTS.md`, ticking the checklist. Out-of-scope breakage
   becomes a new work item with the next free number, not a silent fix. A
   change to a design invariant needs a decision entry in the history file.
   A change to `packages/*` gets `pnpm changeset` in the same series.
5. Gate: `pnpm check`. Run the item's scenario when it can be checked locally
   (`pnpm dev:api` + curl, `pnpm dev:shell` + browser); otherwise list it as
   "사용자 확인 필요".
6. Commit: `type(scope): title` (≤72 chars), one-line summary, bullets,
   `Co-Authored-By` footer only. Hooks run; never `--no-verify`. Do not push.
7. Write `.ai/history/<YYYY-MM-DD-HHmm>_<version>-<N>_<slug>.md` (first line
   `decisions: …`; what was done, commit hash, actual result/errors, fixes,
   decisions ≤10 lines). Tick the plan row, **delete the work file**.
8. If no work file of the rc remains, say the rc is ready for `/test` and
   `/go-ci` (or `/go-cicd`). If none of the version remains, set the plan
   `상태: done`.

## Test workflow

1. Gates: `pnpm install --frozen-lockfile` (if `node_modules` is stale), then
   `pnpm check`. `docker build -f apps/<app>/Dockerfile .` for every app whose
   Dockerfile or inputs changed, when Docker is available.
2. Smoke (only for apps that exist): start `apps/api` on a free port and
   `curl /healthz` → 200; start `apps/shell`, open `/` and one `/game/:id`
   page; if a fixture game is under `apps/shell/dev/games`, open
   `/game/<id>/play` and confirm the `__hello`/`__welcome` handshake in the
   console. Stop everything afterwards.
3. Scenarios: the **검증** sections of the version's history files plus the
   plan's **검증 계획**. Run what can run locally; mark the rest manual.
4. Write `.ai/test/<YYYY-MM-DD-HHmm>_<version>.md`: gates table, scenario table
   (pass / fail / manual), failures with file paths. Failures become new work
   items (next free numbers, normally the same rc) added to the plan table.

Never mark a scenario passed that was not executed. `/test` does not fix.

## GitHub prerequisites

Before any push / PR / release step, check and stop with the list of what is
missing: `git remote get-url origin`, `gh auth status`, a local `master`
tracking `origin/master`, `.github/workflows/{ci,secret-scan,release}.yml` on
`origin/master`. All GitHub operations go through `gh`.

## Sync

`git fetch origin --prune --tags` → `git checkout master && git pull --rebase
origin master` → back on the branch, `git rebase master`. Resolve conflicts and
record how in the history decisions section; stop and ask when the two sides
express conflicting intent and nothing in plan/history/instructions settles it.

## PR → checks → merge (one rc)

1. Preconditions: every work item of the rc is finished, the latest
   `.ai/test/*_<version>.md` after the last commit has no failing gate (run
   `/test` if not), changesets exist for every `packages/*` change.
2. Draft the body in `.ai/pr/<branch>.md` from
   `.github/pull_request_template/<kind>_pr_template.md` (see `/gen-pr`).
   Title: `type(scope): title` style, English.
3. Sync, `git push -u origin <branch>`, then
   `gh pr create --base master --title … --body-file .ai/pr/<branch>.md`.
   Labels come from the labeler.
4. `gh pr checks <n> --watch --fail-fast`. Required: `CI result`,
   `TruffleHog`, `Gitleaks`. Red → read the log
   (`gh run view <id> --log-failed`), fix on the branch with a normal commit,
   push, wait again. Never merge red.
5. `gh pr merge <n> --rebase --delete-branch`, then sync master and delete the
   local branch.
6. If the PR changed `packages/*`, the `Publish Packages` bot opens or updates
   a "chore: version packages" PR. Merging it (same checks) publishes to npm;
   do that only when the user asks, and never publish by hand.

## Release workflow (rc)

1. Preconditions: PR merged, local `master` == `origin/master`, clean tree,
   every work item whose `release` is this rc finished, the rc tag does not
   exist yet, at least one `apps/*/Dockerfile` exists.
2. `gh workflow run release.yml --ref master -f version=X.Y.Z-rc.A -f dry_run=false`,
   find the run (`gh run list --workflow release.yml -L 1`), then
   `gh run watch <id> --exit-status`.
3. Write `.ai/release/X.Y.Z-rc.A_Pre-Release.md` from
   [release-notes.md](./release-notes.md), publish:
   `gh release edit vX.Y.Z-rc.A --notes-file <file> --draft=false --prerelease`.
4. Verify `gh release view vX.Y.Z-rc.A --json name,isDraft,isPrerelease`.
   Record the run URL in `.ai/history/`, update `.ai/README.md` 현재 위치.
5. Deployment to the server is **not** part of the workflow yet (pull the
   image and restart via Compose by hand). Ask before adding any deploy step.

## Stable release (release-prod)

Only when the user explicitly asks for a stable release in the current
conversation. Preconditions: plan `상태: done`, no work file of the version,
the last rc released and confirmed by the user, synced clean `master`, public
docs updated (`README*.md`, `docs/ROADMAP.md` without internal status). Run
the workflow with `-f version=X.Y.Z`; notes from the stable template; publish
with `--draft=false --latest`. Then move the version's roadmap section to a
`## 완료` block in `ROADMAP.local.md`. If anything is uncertain, run with
`dry_run=true` first.

## Error handling and limits

- On any failure (gate, red check, failed run, conflict): search
  `.ai/history/*` for an earlier fix, apply or adapt it, retry. Record new
  fixes in the item's history file.
- Stop and ask the user before anything hard to undo: force push to a shared
  branch, deleting or moving a published tag, a stable release that was not
  explicitly requested, rewriting `master`, publishing an npm package, any
  change to `sdk_versions` lifecycle data, deleting data.
- Push, PR, merge, and release happen only inside the skills whose job they
  are (`go-ci`, `go-cicd`, `release`, `release-prod`, `work-cicd-to`,
  `workflow`). Those skills are user-invoked only
  (`disable-model-invocation: true`). Other skills never push.
