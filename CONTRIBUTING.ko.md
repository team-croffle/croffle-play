# Croffle Play 기여 가이드

플랫폼 개발에 참여해 주셔서 고맙습니다. 이 저장소는 **플랫폼**(셸, API, 룸 서버, 호스트 어댑터, 게임이 쓰는
패키지)이다. 실제로 운영되는 서비스이므로 모든 변경은 리뷰와 CI와 같은 검사를 거친다.

[English](./CONTRIBUTING.md)

## 무엇을 어디에

| 하고 싶은 일       | 가는 곳                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| 게임 만들기        | 각자의 저장소: `npm create @croffledev/play-game <폴더>`. 게임은 이 저장소에 넣지 않는다. |
| 게임 배포·업데이트 | [docs/publishing.md](./docs/publishing.md) (배포 키는 관리자에게)                         |
| 버그 신고, 질문    | [이슈](https://github.com/team-croffle/croffle-play/issues/new/choose)                    |
| 기능·SDK 변경 제안 | 코드보다 먼저 기능 요청 이슈                                                              |
| 보안 문제          | **비공개로** — [SECURITY.md](./SECURITY.md). 공개 이슈 금지                               |

## 준비

Node ≥ 24, Corepack을 통한 pnpm(`corepack enable`, 버전은 `package.json`에 고정).

```bash
pnpm install   # 의존성 + git 훅(lefthook)
pnpm check     # secret files · format · lint · typecheck · test · build — CI와 같은 게이트
```

Docker 없이 로컬에서 플랫폼 실행하기(임베디드 PostgreSQL, 로컬 OpenID 공급자, 픽스처 게임)는
[README](./README.ko.md#개발) 참고.

## 변경하는 법

1. 작은 수정이 아니면 **이슈부터** 열어 접근 방식을 먼저 맞춘다.
2. `master`에서 `type/topic` 이름으로 **브랜치**를 딴다(예: `feat/leaderboard-paging`,
   `fix/rooms-reconnect`). `master`에 직접 커밋하지 않는다. `master`는 PR로만 바뀐다.
3. 작게 나눠 **커밋**하고, `commit-msg` 훅이 검사하는 형식을 따른다:

   ```
   type(scope): 명령형 제목, 72자 이하 (영어)

   왜 바꾸는지 한 줄 요약.

   - 세부 내용은 글머리표로
   ```

   type: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`, `ci`, `style`,
   `revert`, `release`. scope: `shell`, `api`, `rooms`, `adapters`, `protocol`, `sdk`, `cli`,
   `create-game`, `infra`, `ci`, `docs` (저장소 전체 변경이면 생략).

4. **훅을 끄지 않는다.** 포맷·린트·타입 검사·비밀 파일 검사를 한다. `--no-verify` 금지, 원인을 고친다.
5. 바꾼 것을 **테스트**한다. API 테스트는 인메모리 PostgreSQL(PGlite)에 실제 마이그레이션을 적용해
   돈다. 동작 옆에 테스트를 추가하고, UI나 여러 서비스에 걸친 변경은 직접 돌려 본 시나리오를 PR에 적는다.
6. **패키지**(`packages/*`)를 바꾸면 같은 PR에 changeset(`pnpm changeset`)을 넣는다. 손으로 배포하지
   않는다 — 머지 후 _Publish Packages_ 워크플로가 배포한다.
7. 템플릿(기본, 버그 수정, 기능) 중 하나로 **PR을 연다.** 해당되면 _Design invariants_, _SDK contract_
   절을 채운다.

## 리뷰와 머지

- 필수 체크: **CI result**, **TruffleHog**, **Gitleaks**. 빨간 체크는 머지하지 않는다.
- 코드 오너(`.github/CODEOWNERS`)에게 리뷰가 자동 요청된다. 머지 전에 모든 리뷰 스레드를 해결한다.
- **Rebase and merge**만 쓴다. `master` 이력은 일직선. 브랜치는 `master`를 merge하지 말고 rebase한다.
- 릴리스는 관리자가 `master`에서 만든다(git 태그 `vX.Y.Z-rc.N` → `vX.Y.Z`).
  [docs/operations.md](./docs/operations.md) 참고.

## 특히 조심할 규칙

- **설계 불변식**([AGENTS.md](./AGENTS.md)) — 셸은 게임 코드를 품지 않는다, 번들은 불변, 인증은 셸에만,
  게임 서버는 신뢰하지 않는다, 스토리지는 S3 API로만 등. 바꾸려면 이슈, [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)에
  결정 기록, 관리자 승인이 필요하다.
- **SDK 프로토콜은 공개 계약이다.** `__hello`/`__welcome` 핸드셰이크는 절대 바뀌지 않는다. 새 메시지는
  추가만 하고 capability와 함께 낸다. 이름 변경·삭제는 새 SDK 메이저(호스트 어댑터 + 마이그레이션)다.
  모든 메시지는 `packages/protocol`에 한 번만 정의한다.
- 셸·API에 **게임별 코드 금지.** 게임에 필요한 것은 protocol → adapter → API 경로로.
- **비밀값**은 저장소에 들어오지 않는다. `.env*`는 로컬에만, 변수 설명은 `*.example`에. 훅과 CI가 모든
  push를 검사한다.

## 작성 언어

코드, 커밋 메시지, PR, 릴리스 노트는 영어. `README.md`, `CONTRIBUTING.md`는 한국어판이 옆에 있고,
`docs/` 문서는 한국어. 포맷은 oxfmt가 정한다 — 손으로 맞추지 말고 `pnpm format`.

## 라이선스

기여한 내용은 [MIT 라이선스](./LICENSE)로 제공되는 데 동의하는 것으로 본다.
