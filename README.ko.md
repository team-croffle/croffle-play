# Croffle Play

[Team Croffle](https://github.com/team-croffle)의 웹 게임 플랫폼. 팀원이 각자의 저장소에서 원하는 엔진으로
게임을 만들어 이 플랫폼에 올린다. 플랫폼은 카탈로그, 공통 계정, 점수·저장, 멀티플레이 룸, 그리고 게임이
사용하는 SDK를 제공한다.

[English](./README.md)

> 상태: **초기 개발.** 카탈로그, 실행 페이지, SDK v1, 런타임 호스트 어댑터, 배포 파이프라인(play-cli →
> 검토 → 승인)이 동작한다. 계정과 멀티플레이는 [로드맵](./docs/ROADMAP.md) 순서로 진행한다. 설계 기록: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## 구조

```
Shell (Nuxt)  ──  카탈로그 · 로그인 · 실행 페이지
   │ iframe      https://<game>.croffle-play.link/<version>/
게임 번들      ──  게임 작성자가 빌드, 버전별 불변
   │ postMessage (SDK 프로토콜, 빌드 시점에 고정)
호스트 어댑터  ──  SDK 메이저당 하나, 런타임에 로딩
   │
Shell core  ──►  API (NestJS)  ──►  PostgreSQL · S3 스토리지
```

- 셸은 게임 코드를 포함하지 않으므로 게임 수가 늘어도 커지지 않는다.
- 게임 버전은 전용 서브도메인의 불변 정적 번들이고, 노출되는 버전은 포인터다.
- 게임은 빌드할 때의 SDK 버전에 고정된다. 새 SDK는 셸 배포가 아니라 어댑터로 나간다. 오래된 메이저는
  공개된 일정에 따라 `lts → deprecated → eol`로 이동한다.
- 로그인은 셸에서만 한다. 게임은 SDK를 통해 신원을 전달받는다.

## 저장소 구성 (계획)

| 경로                | 패키지                      | 배포 형태     |
| ------------------- | --------------------------- | ------------- |
| `apps/shell`        | `@croffledev/play-shell`    | Docker 이미지 |
| `apps/api`          | `@croffledev/play-api`      | Docker 이미지 |
| `apps/rooms`        | `@croffledev/play-rooms`    | Docker 이미지 |
| `apps/adapters`     | `@croffledev/play-adapters` | 정적 번들     |
| `packages/protocol` | `@croffledev/play-protocol` | npm           |
| `packages/sdk`      | `@croffledev/play-sdk`      | npm           |
| `packages/cli`      | `@croffledev/play-cli`      | npm           |

게임은 이 저장소에 **없다.** 게임 템플릿 저장소에서 생성하고 `play-cli`로 배포한다.

## 개발

Node ≥ 24, pnpm (Corepack) 필요.

```bash
pnpm install        # 의존성 + git 훅 설치
pnpm check          # secret-files · format · lint · typecheck · test · build
```

API와 셸 로컬 실행. Docker가 없으면 API가 임베디드 Postgres(PGlite)와 더미 카탈로그로 뜬다:

```bash
cp apps/api/.env.example apps/api/.env   # DATABASE_URL=pglite://memory, DB_SEED=true
pnpm dev:api                             # http://localhost:3001 (/healthz, /v1/games)
pnpm dev:shell                           # http://localhost:3000
```

컨테이너로 전체 스택(PostgreSQL, MinIO, 게임 도메인 엣지, API, 셸). 배포 세부 사항은
[infra/README.md](./infra/README.md):

```bash
cp infra/.env.example infra/.env         # CHANGE_ME 값 교체
docker compose -f infra/compose.yml --env-file infra/.env up --build
```

로컬에서 게임 실행 (`sample` 픽스처, 실제 게임처럼 별도 origin에서 서빙):

```bash
pnpm dev:games    # 픽스처 + 호스트 어댑터 빌드, http://localhost:4100
# apps/api/.env: GAME_URL_TEMPLATE=http://{id}.localhost:4100/{version}/
#                SEED_ADAPTER_MANIFEST_URL=http://localhost:4100/adapters/v1/dev/manifest.json
pnpm dev:api && pnpm dev:shell    # http://localhost:3000/game/sample/play
```

## 게임 만들기

게임은 [`@croffledev/play-sdk`](./packages/sdk)를 번들에 넣고 SDK로만 플랫폼과 통신한다:

```ts
import { createSdk } from '@croffledev/play-sdk';

const sdk = await createSdk({ game: 'tetris' });
await sdk.ready();
if (sdk.has('score')) await sdk.submitScore(1200);
```

플랫폼 밖에서는 `@croffledev/play-sdk/mock`의 `transport: createMockHost()`로 단독 실행한다. 배포(배포 키,
`play-cli`, 검토·승인): [docs/publishing.md](./docs/publishing.md).

사람과 에이전트 공통 기여 규칙: [AGENTS.md](./AGENTS.md).

## 라이선스

MIT
