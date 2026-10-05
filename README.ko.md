# Croffle Play

[Team Croffle](https://github.com/team-croffle)의 웹 게임 플랫폼. 계정 하나로 모든 게임을 한다. 포털이
로그인, 카탈로그, 점수·저장, 멀티플레이 룸, 그리고 게임이 사용하는 SDK를 제공한다. 팀원은 각자의 저장소에서
원하는 엔진으로 게임을 만들어 직접 호스팅하고, 포털은 각 게임을 iframe으로 띄운다.

[English](./README.md)

> 상태: **정식 출시 전.** 포털(카탈로그, 실행 페이지, 관리자·개발자 화면), SDK v1, 런타임 호스트 어댑터,
> `game.json` 기반 게임 등록, 계정(로그인, 점수, 리더보드, 저장), 멀티플레이 룸이 동작한다.
> [로드맵](./docs/ROADMAP.md) 참고. 설계 기록: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## 구조

```
포털 (Nuxt)    ──  카탈로그 · 로그인 · 실행 페이지          www.croffle-play.link
   │ iframe       https://<game>.play.croffle-play.link/  (게임 팀이 호스팅)
게임 사이트    ──  game.json 제공, 포털의 iframe 허용
   │ postMessage (SDK 프로토콜, 빌드 시점에 고정)
호스트 어댑터  ──  SDK 메이저당 하나, 게임 핸드셰이크로 골라 런타임에 로딩
   │
포털 core  ──►  API (NestJS)  ──►  PostgreSQL · S3 API (플랫폼 파일)
```

- 포털은 게임 코드를 포함하지 않으므로 게임 수가 늘어도 커지지 않는다.
- 플랫폼은 게임 파일을 저장하지 않고 게임 버전도 추적하지 않는다. 게임은 id, 공개 여부, 그리고 게임 호스트가
  제공하는 `game.json`이다.
- 게임은 빌드할 때의 SDK 버전에 고정된다. 새 SDK는 포털 배포가 아니라 어댑터로 나간다. 오래된 메이저는 공개된
  일정에 따라 `lts → old → deprecated`로 이동한다.
- 로그인은 포털에서만 한다. 게임은 SDK를 통해 신원을 전달받는다.
- 플랫폼 배포와 운영은 이 저장소 밖의 일이다. 앱은 이미지로 나간다.

## 저장소 구성

| 경로                   | 패키지                         | 배포 형태          |
| ---------------------- | ------------------------------ | ------------------ |
| `apps/shell`           | `@croffledev/play-shell`       | Docker 이미지      |
| `apps/api`             | `@croffledev/play-api`         | Docker 이미지      |
| `apps/rooms`           | `@croffledev/play-rooms`       | Docker 이미지      |
| `apps/adapters`        | `@croffledev/play-adapters`    | 정적 번들          |
| `packages/protocol`    | `@croffledev/play-protocol`    | npm                |
| `packages/sdk`         | `@croffledev/play-sdk`         | npm                |
| `packages/cli`         | `@croffledev/play-cli`         | npm                |
| `packages/create-game` | `@croffledev/create-play-game` | npm (`npm create`) |

게임은 이 저장소에 **없다.** 게임마다 독립 저장소를 두며, `npm create @croffledev/play-game <폴더>`로 만든다.

## 개발

Node ≥ 24, pnpm (Corepack) 필요.

```bash
pnpm install        # 의존성 + git 훅 설치
pnpm check          # secret-files · format · lint · typecheck · test · build
```

Docker 없이 로컬에서 게임 실행(API는 임베디드 Postgres와 더미 카탈로그, 픽스처 게임은 실제 게임처럼 각자 origin에서
서빙):

```bash
pnpm dev:games    # 픽스처 + 호스트 어댑터 빌드, http://<id>.localhost:4100/
DATABASE_URL=pglite://memory DB_SEED=true \
  SEED_ADAPTER_MANIFEST_URL=http://localhost:4100/adapters/v1/dev/manifest.json pnpm dev:api
pnpm dev:shell    # http://localhost:3000/game/sample/play
```

로컬 로그인: `pnpm dev:oidc`가 `:4300`에 대체 OpenID 공급자를 띄운다(아무 로그인 이름이나 가능).
`apps/api/.env.example`, `apps/shell/.env.example`의 OIDC 변수를 설정하고, `ADMIN_SUBS=admin`이면 `admin`으로
로그인한 사용자가 관리자가 된다.

## 게임 만들기

게임은 [`@croffledev/play-sdk`](./packages/sdk)를 번들에 넣고 SDK로만 플랫폼과 통신한다:

```ts
import { createSdk } from '@croffledev/play-sdk';

const sdk = await createSdk({ game: 'tetris' });
await sdk.ready();
if (sdk.has('score')) await sdk.submitScore(1200);
```

플랫폼 밖에서는 `@croffledev/play-sdk/mock`의 `transport: createMockHost()`로 단독 실행한다. 게임 호스팅과 등록:
[docs/game-hosting.md](./docs/game-hosting.md). 멀티플레이 룸: [docs/multiplayer.md](./docs/multiplayer.md).
전용 서버가 필요한 게임: [docs/game-servers.md](./docs/game-servers.md). SDK 버전과 업그레이드:
[docs/sdk-lifecycle.md](./docs/sdk-lifecycle.md). 보안 모델: [docs/security.md](./docs/security.md).

## 기여

[CONTRIBUTING.ko.md](./CONTRIBUTING.ko.md)(작업 흐름, 커밋 형식, 리뷰)와 [AGENTS.md](./AGENTS.md)(설계 불변식,
컨벤션 — AI 에이전트도 읽음) 참고. 보안 문제: [SECURITY.md](./SECURITY.md).

## 라이선스

[MIT](./LICENSE) © Croffle Dev. (Team Croffle)
