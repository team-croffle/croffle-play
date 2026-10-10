# Croffle Play — 아키텍처

설계 기록. 결정 사항을 적어두고, 바뀌면 이 문서를 갱신한다. 불변식은 `AGENTS.md` *Design invariants*가
원본이고 여기서는 이유와 세부를 적는다.

## 1. 문제와 방향

계정 하나로 여러 게임을 하는 플랫폼이다(Steam 계정과 비슷하다). 게임은 팀원이 각자 만들고 **각자 호스팅**하며,
포털은 계정·목록·공통 UI를 맡고 게임을 iframe으로 띄운다. 게임이 수백 개로 늘어도 포털 번들과 배포가 커지지
않아야 하고, 배포·운영(서버, 프록시, DNS, 백업)은 이 저장소의 일이 아니다.

| 선택지                           | 판단                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| 코드 스플리팅 (앱 하나)          | 모든 게임이 같은 기술·저장소여야 함. 엔진 자유가 없음         |
| 게임 사이트로 이동 (iframe 없음) | 공통 UI가 사라지고 게임마다 로그인·토큰 처리가 필요           |
| **포털 + iframe + 팀원 호스팅**  | 채택. 공통 UI 유지, 게임은 토큰을 보지 않음, 엔진·호스팅 자유 |

도메인: 포털 `game.croffle-play.link`, 게임 `<id>.play.croffle-play.link`(게임마다 origin이 다르다). 코드는
도메인을 env로만 안다.

## 2. 계층

```
[게임 사이트]      팀원이 호스팅. 번들에 @croffledev/play-sdk vX.Y (빌드 시점 고정)
   │ postMessage  SDK vX 프로토콜
[Host Adapter vX] 포털이 __hello의 메이저로 골라 런타임에 import (SRI 검증)
   │              Core API
[Portal Core]     핸드셰이크, 어댑터 로딩, identity / api() / ui / lifecycle
   │ REST /v1 (포털 서버가 BFF)
[API]             게임 등록, 카탈로그, 점수/저장, 토큰 발급, sdk_versions, 어댑터 서빙
```

- **Portal core**는 거의 바뀌지 않는다. 새 SDK 기능 = API 엔드포인트 + 어댑터 배포. 포털을 다시 배포하는
  경우는 Core 자체에 새 능력(새 UI, 브라우저 권한 등)이 필요할 때뿐이다.
- **어댑터**는 SDK 메이저당 하나. 마이너는 기능 추가만 하므로 v2 어댑터 하나가 2.x 전체를 처리한다. 포털
  origin에서 실행되므로 신뢰 코드여야 한다 → 플랫폼 담당만 배포, DB에 SRI 해시 저장.

### 핸드셰이크 (유일하게 고정되는 프로토콜)

```ts
// 게임 → 포털
{ type: '__hello', sdk: '2.3.1', game: 'tetris' }

// 포털
const v = await sdk(major(hello.sdk));            // sdk_versions
if (!v || v.status === 'deprecated') return showNotUpdated();
const adapter = await loadAdapter(v.adapterUrl, v.sri); // 같은 origin /adapters/…, SRI
adapter.mount({ core, port, sdkVersion: hello.sdk });

// 포털 → 게임
{ type: '__welcome', capabilities: ['score', 'save', 'leaderboard'] }
```

마이너 차이는 capability로 처리한다. 게임은 `sdk.has('leaderboard')`로 확인한 뒤 사용한다.

### v1 메시지와 origin 규칙 (구현: `packages/protocol`)

```ts
{ ns: 'croffle-play', v: 1, kind: 'req', id: '7', type: 'submitScore', payload: { score: 1200 } }
{ ns: 'croffle-play', v: 1, kind: 'res', id: '7', ok: true, payload: { accepted: true } }
{ ns: 'croffle-play', v: 1, kind: 'res', id: '8', ok: false, error: { code: 'auth_required', message } }
{ ns: 'croffle-play', v: 1, kind: 'evt', type: 'pause' }
```

- 요청 `ready`, `getUser`, `submitScore`, `save`, `load`, `exit`, `fullscreen` / 이벤트 `pause`, `resume`.
  요청마다 필요한 capability가 있고, SDK는 없는 capability 요청을 보내지 않고 `unsupported`로 거절한다.
- SDK: `__hello`만 `targetOrigin: '*'`(민감 정보 없음)로 보내고 `__welcome`을 보낸 origin에 고정한다. 이후
  `window.parent`가 아닌 곳, 고정 origin이 아닌 곳의 메시지는 무시한다. 요청 기본 타임아웃 10초.
- 포털: iframe의 `contentWindow` **그리고** 게임 origin에서 온 메시지만 받고, 게임 origin으로만 보낸다.
  hello의 게임 id가 등록된 id와 다르면 실행하지 않는다.
- 어댑터: `import()`는 integrity를 지원하지 않으므로 포털이 번들을 받아 `sdk_versions.sri`(SHA-384)와 비교한
  뒤 Blob URL로 import한다. 어댑터는 npm 패키지 `@croffledev/play-adapter-v<N>`(메이저당 하나, SDK와 linked)다:
  api가 레지스트리에서 **이 api와 호환되는(manifest `requiresApi`) 가장 새 릴리스**를 받아(sha512·sha384 검증)
  스토리지(`adapters/v<N>/<버전>/index.js`)에 올리고 활성화한다 — 시작 때와 주기적으로. 그래서 어댑터 릴리스에는
  포털도 api도 배포하지 않는다. 처음 띄울 때만 이미지에 든 번들을 쓴다. 등록된 버전은 `sdk_adapter_versions`에
  남고 관리자가 `/admin/sdk`에서 설치·전환·삭제한다. API가 `/v1/adapters/…`로 서빙하고 포털이 같은 origin
  `/adapters/…`로 중계하므로 브라우저에는 CORS도, 스토리지 주소도 없다.
- iframe: `sandbox="allow-scripts allow-same-origin allow-pointer-lock"`, `allow="fullscreen; autoplay;
gamepad"`. `allow-same-origin`은 게임 자신의 origin이다(게임 origin ≠ 포털 origin).

## 3. SDK 버전 수명주기

`sdk_versions`에 상태와 날짜(`old_at`, `deprecated_at`)를 두고, 정책 변경은 데이터 수정으로 끝낸다. 관리자는
포털 `/admin/sdk`에서 바꾸고(앞으로만, deprecated는 확인 입력), 모든 변경은 `sdk_admin_events`에 기록된다.

| 상태       | 실행  | 새 공개·game.json 새로고침 | 표시                                       |
| ---------- | ----- | -------------------------- | ------------------------------------------ |
| current    | O     | O                          | —                                          |
| lts        | O     | O                          | —                                          |
| old        | O     | **X**                      | 개발자·관리자 경고                         |
| deprecated | **X** | X                          | 목록에 남되 "업데이트되지 않음", 실행 불가 |

- 동시에 실행 가능한(current·lts·old) 메이저는 3개까지 (어댑터마다 유지보수 대상).
- 구현: 상태는 `effectiveStatus()`로 날짜에서 계산해 모든 조회에 쓰고, 매시간 작업이 저장값을 맞추며
  `sdk_version_events`에 기록하고 GitHub 이슈로 알린다. 정책·알림·업그레이드 절차는
  [sdk-lifecycle.md](./sdk-lifecycle.md).
- 등록 때의 메이저는 `game.json`의 `sdk` 범위, 실행 때의 메이저는 `__hello`. 실행 여부와 어댑터는 `__hello`
  기준이다.

## 4. 인증

로그인은 포털에서만 하고 신원은 SDK로 전달한다. 게임은 같은 사이트(`croffle-play.link`)지만 다른 호스트이고,
팀원이 운영하는 서버라 포털 세션을 절대 받지 않는다.

- **Tier 1 (기본)**: 게임은 토큰을 만지지 않는다. `sdk.submitScore()` 등은 postMessage로 포털에 가고, 포털이
  자기 세션으로 API를 호출한다. 게임이 받는 건 `{ id, nickname, avatar }` 뿐.
- **게임 서버**: 포털이 API에 `aud: game:<id>`로 제한된 5~15분 JWT를 요청 → postMessage로 게임에 전달 →
  게임 서버는 플랫폼 JWKS로 검증 → 만료 시 `sdk.getToken()`으로 갱신. 쿼리스트링 금지. `aud` 제한 이유: 게임
  A가 털려도 B나 플랫폼 API에 못 간다.
- IdP: 직접 구현하지 않고 OIDC 프로바이더 셀프호스팅 — **Logto**. API 쪽은 `jose`로 JWKS 검증만.

### 같은 사이트 방어

- 포털 세션 쿠키는 `__Host-`(Domain 없음, 포털 호스트 전용) → 게임 호스트로 가지 않고 게임이 덮어쓸 수 없다.
- 상태를 바꾸는 포털 `/api` 요청은 포털 자신의 Origin만 받는다(같은 사이트의 게임 페이지에서 온 요청 거부).
- API는 쿠키가 아니라 토큰으로만 인증하고, 브라우저는 API를 직접 부르지 않는다(BFF, CORS 없음).
- 게임은 `frame-ancestors <포털>`로 포털만 iframe을 허용해야 한다. 플랫폼이 강제할 수는 없으므로
  `play-cli check`로 확인한다.

### 구현 (Tier 1)

- 포털 서버가 OIDC 클라이언트다: authorization code + PKCE, state·nonce, `resource=<API>`로 API용 JWT access
  token, `offline_access` + `prompt=consent`로 refresh token. 토큰은 h3 sealed 세션 쿠키 안에만 있고 브라우저
  JS·게임은 보지 못한다. 만료 1분 전에 갱신.
- API는 `iss`·`aud`·서명·만료를 검증하고 IdP `sub`를 내부 계정(uuid)에 매핑한다. 게임이 받는 건
  `{ id, nickname, avatar }`뿐이고 `sub`·역할·토큰은 나가지 않는다.
- 관리자 = 계정의 `admin` 역할. 첫 관리자는 `ADMIN_SUBS`(로그인 시 승격) 또는 `grant-admin`.
- 세션 저장: 기본은 봉인 쿠키. `NUXT_SESSION_REDIS_URL`이 있으면 Redis 프로토콜 서버(Valkey 등)에 데이터를 두고
  쿠키에는 봉인된 세션 id만 둔다.
- 플레이어 대시보드 `/me`: 닉네임, 프로필 사진 직접 업로드(PNG·JPEG·WebP, 헤더로 판별, 64px 이상, 512KB 이하,
  JPEG EXIF 제거). 스토리지 `avatars/<user>/<hash>.<ext>`, API 서빙 + 포털 `/avatars/…` 중계. 올린 사진은
  로그인 때 IdP 사진으로 덮이지 않는다. 게임에는 절대 URL로 전달된다.
- 로컬 개발은 `pnpm dev:oidc`(oidc-provider)가 Logto를 대신한다. 포털은 표준 OIDC만 쓰므로 동작이 같다.

## 5. 게임 등록과 호스팅

게임은 자기 origin에서 서빙된다. 누가 서빙하는지는 게임마다 고른다 — **팀 호스팅**(기본, 플랫폼은 파일을 받지도
서빙하지도 않음) 또는 **플랫폼 호스팅**(팀이 zip을 올리고 플랫폼의 게임 호스트 `apps/games`가 같은 origin에서
서빙). 어느 쪽이든 플랫폼이 추적하는 게임 버전은 플랫폼 호스팅의 최근 업로드 몇 개(되돌리기용)뿐이다.

```
https://<id>.play.croffle-play.link/            ← 팀원이 호스팅 (어디든) 또는 apps/games
├─ index.html     # 진입 (game.json entry)
├─ game.json      # 포털이 읽는 메타데이터
├─ thumb.png      # 카탈로그 썸네일 (선택)
└─ assets/...
```

- 게임 주소는 `GAME_ORIGIN_TEMPLATE`(`https://{id}.play.croffle-play.link`)과 검증된 id로만 정해진다. 그래서
  API가 `game.json`을 가져올 때 임의 호스트에 요청하지 않고, 룸 서버의 Origin 검사도 같은 템플릿을 쓴다.
- **origin은 게임 단위.** 같은 origin에 전 게임을 두면 localStorage/IndexedDB를 공유하고, `allow-same-origin`
  을 빼면 IndexedDB를 쓰는 엔진(Unity 등)이 깨진다.
- 예약 id: `www`, `api`, `admin`, `cdn`, `play`, `rooms`, `auth`, `static`.

### 플랫폼 호스팅 (업로드)

```
포털(/admin, /dev) 또는 play-cli deploy(배포 키 cdk_)
   │ application/zip
   ▼
API: zip 검사(yauzl, 상한·경로·링크·game.json id·SDK 메이저) → 스토리지 games/<id>/<deploy>/<path>
     game_deploys 행 → games.active_deploy_id + games/<id>/current.json {deployId, entry}
   ▼
apps/games: Host → id → current.json(10초 캐시) → 파일 (frame-ancestors·nosniff·ETag)
```

- 게임 호스트는 DB·API 없이 스토리지만 읽는다. 게임 수와 무관한 이미지 하나. 포인터가 없는 id는 404(팀 호스팅
  게임의 Host가 와도 그렇다 — DNS 와일드카드는 게임 호스트로, 팀 호스팅 게임은 개별 레코드로 보낸다).
- `game.json`은 zip 안의 것이다(origin에서 다시 읽지 않음). 최근 `DEPLOY_KEEP`(기본 5)개를 보관하고 되돌리기는
  포인터 전환, 그보다 오래된 업로드는 스토리지에서 지운다.
- 배포 키(`cdk_`)는 서버 키(`csk_`)와 같은 꼴(해시 저장, 1회 표시, 교체·폐기)이고 그 게임의 업로드에만 쓰인다.

### 등록 흐름

```
관리자: 게임 등록 (id, 이름)                       ← listed=false
팀원: <id>.play.croffle-play.link에 배포 → play-cli check <url>   (팀 호스팅)
      또는 zip 업로드 (포털 / play-cli deploy)                    (플랫폼 호스팅)
관리자: game.json 다시 읽기 (팀 호스팅만)          ← id 일치, SDK 메이저 current·lts, 실패 사유 기록
관리자: 공개                                       ← listed=true, 카탈로그에 노출
```

- `game.json`을 읽지 못하거나 메이저가 old·deprecated면 새 공개·새로고침을 거부하고 이전 값을 유지한다.
- 관리자 미리보기: `/game/:id/play?preview=1`(비공개 게임도 실행).
- 콘텐츠 업데이트는 플랫폼에서 할 일이 없다. SDK 메이저를 올렸을 때만 새로고침한다.

## 6. 멀티플레이

- 통신은 **WebSocket** 기본. WebRTC DataChannel과 WebTransport는 초기 제외.
- **공용 룸 서버**(`apps/rooms`): 방·인원 관리와 메시지 중계만. 로직은 클라이언트(방장). 게임별 서버 불필요.
  Colyseus·Nakama 대신 자체 `ws` 서버 — 중계만 하므로 작고, 메시지 형식은 `packages/protocol`(`rooms.ts`).
- 게임 iframe이 룸 서버에 **직접** 연결한다. 포털을 거쳐 postMessage로 중계하지 않는다.
- SDK가 숨기는 것: 30초 ping, 지수 백오프 재연결 + 같은 방 재입장, `reconnecting` 이벤트. 인증은 연결 직후
  **첫 메시지**로 토큰 전송(쿼리스트링 금지), 서버는 `Origin`을 게임 origin 템플릿과 대조.
- 권위 서버가 필요한 게임은 **자체 서버**를 둔다. 팀이 호스팅하고 `game.json`의 `server: { url, protocol }`로
  알린다. 플랫폼은 서버를 실행·승인·연결하지 않고 게임 토큰(JWKS)과 검증 점수용 서버 키만 준다. 절차는
  [game-servers.md](./game-servers.md).
- 구현 세부: 방 키는 `<게임>:<방>`, 방장은 가장 오래 있은 멤버, 프레임 16KB, 연결당 초당 30개, 인증 5초, 상태는
  메모리(단일 인스턴스). 토큰 `sub`는 공개 계정 id, `nickname` 클레임 포함 → 룸 서버는 DB 없이 동작. 사용법은
  [multiplayer.md](./multiplayer.md).

## 7. 배포와 운영

이 저장소는 앱 이미지(GHCR)까지만 만든다. 앱(api·rooms·shell·games)은 각자 버전 라인으로 릴리스되고(태그
`<app>-vX.Y.Z`), 앱 사이에 맞아야 하는 것은 `docs/reference/env.md`의 호환 표가 정한다. 어디서 어떻게 돌릴지(프록시,
DNS, 인증서, 데이터베이스, 스토리지 제품, 백업, 모니터링)는 저장소 밖에서 정한다. 코드는 규격(PostgreSQL, S3 API, OIDC)에만 의존하고 특정 제품이나
호스트를 가정하지 않는다.

## 8. 저장소 구성

```
croffle-play/   (이 저장소, 플랫폼 담당 관리)
├─ apps/shell (포털)  apps/api  apps/rooms  apps/games (업로드 게임 호스트)  apps/adapters
└─ packages/protocol  packages/sdk  packages/cli  packages/create-game (게임 템플릿)

<game>/               게임마다 독립 저장소 (`npm create @croffledev/play-game`으로 생성)
```

게임을 모노레포에 넣지 않는 이유: 엔진·빌드·호스팅 자유, 게임 단위 권한, 플랫폼 CI가 게임 수에 비례하지
않음. 템플릿에는 `game.json`, `@croffledev/play-sdk` + 개발용 mock 호스트(플랫폼 없이 단독 실행), 선택용
정적 서빙 `Dockerfile` + `Caddyfile`(포털만 iframe 허용)이 들어간다. 템플릿은 `packages/create-game`에 있어
SDK·CLI와 같은 릴리스로 버전이 맞춰지고, 이 저장소 CI가 템플릿에서 만든 게임을 실제로 빌드·검증한다.

## 9. 기술 스택 (확정)

| 영역      | 선택                                                       | 이유                                                 |
| --------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| API       | NestJS + Fastify                                           | 모듈 구조, 가벼운 HTTP 계층                          |
| DB        | PostgreSQL + Drizzle (SQL 마이그레이션 `apps/api/drizzle`) | 스키마가 코드, 생성된 SQL을 그대로 리뷰·적용         |
| 테스트 DB | PGlite (WASM Postgres)                                     | Docker 없이 실제 마이그레이션으로 테스트·로컬 실행   |
| 포털      | Nuxt (SSR) + Nitro 서버 라우트                             | 카탈로그 SEO, 브라우저는 API를 직접 부르지 않음(BFF) |
| 검증      | valibot                                                    | env·프로토콜·매니페스트 공용, SDK 번들 크기가 작다   |
| IdP       | Logto (OIDC, 셀프호스팅)                                   | 가볍고 Postgres 사용, 표준 OIDC라 교체 비용 낮음     |
| 룸 서버   | 자체 `ws` 서버 (중계만)                                    | 메시지 형식을 protocol 패키지가 직접 통제            |
| 도메인    | 포털 `game.croffle-play.link`, 게임 `<id>.play.…` (env)    | 계정 통합의 중심이 되는 플랫폼 도메인                |
