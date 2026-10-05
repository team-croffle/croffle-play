# Croffle Play — 아키텍처

설계 기록. 구현 전 결정 사항을 적어두고, 바뀌면 이 문서를 갱신한다. 불변식은 `AGENTS.md`
*Design invariants*가 원본이고 여기서는 이유와 세부를 적는다.

## 1. 문제와 방향

게임이 수백 개로 늘어도 플랫폼 번들과 배포가 커지지 않아야 한다. 그래서 게임을 플랫폼 앱의 일부로
넣지 않고, **독립 빌드·독립 배포되는 정적 번들**로 분리하고 플랫폼은 "셸"만 담당한다.

| 선택지                       | 판단                                                                |
| ---------------------------- | ------------------------------------------------------------------- |
| 코드 스플리팅 (lazy route)   | 초기 번들은 작지만 빌드·저장소·배포가 게임 수에 비례. 수십 개까지만 |
| **셸 + 독립 번들 + iframe**  | 채택. CrazyGames/Poki/itch.io 구조. 엔진 자유, 격리, 정리 비용 0    |
| Module Federation / 원격 ESM | 셸과 UI를 섞어야 할 때만. 정리 책임이 셸로 돌아오고 버전 호환 부담  |

## 2. 계층

```
[게임]            번들에 포함된 @croffledev/play-sdk vX.Y (빌드 시점 고정)
   │ postMessage  SDK vX 프로토콜
[Host Adapter vX] 셸이 런타임에 스토리지에서 동적 import (SRI 검증)
   │              Core API
[Shell Core]      핸드셰이크, 어댑터 로딩, identity / api() / ui / lifecycle
   │ REST /v1
[API]             카탈로그, 점수/저장, publish, 토큰 발급, sdk_versions
```

- **Shell core**는 거의 바뀌지 않는다. 새 SDK 기능 = API 엔드포인트 + 어댑터 배포. 셸을 다시 배포하는
  경우는 Core 자체에 새 능력(새 UI, 브라우저 권한 등)이 필요할 때뿐이다.
- **어댑터**는 SDK 메이저당 하나. 마이너는 기능 추가만 하므로 v2 어댑터 하나가 2.x 전체를 처리한다.
  셸 origin에서 실행되므로 신뢰 코드여야 한다 → 플랫폼 담당만 배포, DB에 SRI 해시 저장.

### 핸드셰이크 (유일하게 고정되는 프로토콜)

```ts
// 게임 → 셸
{ type: '__hello', sdk: '2.3.1', game: 'tetris' }

// 셸
const v = await registry.get(major(hello.sdk)); // sdk_versions 테이블
if (v.status === 'eol') return showUnsupported();
const adapter = await import(/* @vite-ignore */ v.adapterUrl); // SRI
adapter.mount({ core, iframe, sdkVersion: hello.sdk });

// 셸 → 게임
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
- SDK: `__hello`만 `targetOrigin: '*'`(민감 정보 없음)로 보내고 `__welcome`을 보낸 origin에 고정한다.
  이후 `window.parent`가 아닌 곳, 고정 origin이 아닌 곳의 메시지는 무시한다. 요청 기본 타임아웃 10초.
- 셸: iframe의 `contentWindow` **그리고** 게임 origin(play 정보의 URL)에서 온 메시지만 받고, 게임
  origin으로만 보낸다. hello의 게임 id·SDK major가 등록된 버전 매니페스트와 다르면 실행하지 않는다.
- 어댑터 로딩: `import()`는 integrity를 지원하지 않으므로 셸이 번들을 받아 `sdk_versions.sri`(SHA-384)와
  비교한 뒤 Blob URL로 import한다. 어댑터는 `apps/adapters` 빌드가 쓰는
  `adapters/v<major>/<버전>/{index.js,manifest.json}`에서 오고, API `sdk:register <manifest-url>`로 등록한다.
- iframe: `sandbox="allow-scripts allow-same-origin allow-pointer-lock"`,
  `allow="fullscreen; autoplay; gamepad"`. 게임이 다른 등록 도메인이라 `allow-same-origin`이 안전하다.

## 3. SDK 버전 수명주기

`sdk_versions` 테이블에 상태와 날짜(`deprecated_at`, `eol_at`)를 두고, 정책 변경은 데이터 수정으로
끝낸다. 전환은 배치 또는 조회 시점 계산으로 자동 처리.

| 상태        | 실행  | 새 게임 버전 publish | 표시                         |
| ----------- | ----- | -------------------- | ---------------------------- |
| current     | O     | O                    | —                            |
| lts         | O     | O                    | —                            |
| maintenance | O     | O (경고)             | 개발자 대시보드 경고         |
| deprecated  | O     | **X**                | 카탈로그 "곧 지원 종료" 배지 |
| eol         | **X** | X                    | "지원 종료", 실행 불가       |

- 동시에 살아있는 메이저는 2~3개로 제한 (어댑터마다 유지보수 대상). 연 1회 메이저, LTS 18개월 정도.
- 구현: 상태는 `effectiveStatus()`로 날짜에서 계산해 모든 조회(play·publish·카탈로그)에 쓰고, 매시간 작업이
  저장값을 맞추며 `sdk_version_events`에 기록하고 알림(GitHub 이슈)을 보낸다. 정책·알림·업그레이드 절차는
  [sdk-lifecycle.md](./sdk-lifecycle.md).
- 게임이 알아서 올리게 하는 장치: publish 게이트, deprecated 전환 시 게임 저장소에 GitHub 이슈 자동
  생성(EOL 날짜 + 마이그레이션 가이드), 템플릿의 Renovate, 메이저 전환용 codemod
  (`npx @croffledev/play-sdk migrate 2-to-3`).

## 4. 인증

게임 origin은 플랫폼과 다른 등록 도메인이라 **플랫폼 세션 쿠키를 쓸 수 없다**(서드파티 쿠키 차단).
로그인은 셸에서만 하고 신원은 SDK로 전달한다.

- **Tier 1 (기본, 서버 없는 게임)**: 게임은 토큰을 만지지 않는다. `sdk.submitScore()` 등은
  postMessage로 셸에 가고, 셸이 자기 세션으로 API를 호출한다. 게임이 받는 건
  `{ userId, nickname, avatar }` 뿐.
- **Tier 2 (승인제, 자체 서버 게임)**: 셸이 API에 `aud: game:<id>`로 제한된 5~15분 JWT를 요청 →
  postMessage로 게임에 전달 → 게임 서버는 플랫폼 JWKS로 검증 → 만료 시 `sdk.getToken()`으로 갱신.
  쿼리스트링 금지 (프록시 로그에 남음). `aud` 제한 이유: 게임 A가 털려도 B나 플랫폼 API에 못 간다.
- IdP: 직접 구현하지 않고 OIDC 프로바이더 셀프호스팅 — **Logto**(같은 PostgreSQL의 별도 DB).
  API 쪽은 `jose`로 JWKS 검증만. 나중에 외부 개발자·모바일 앱도 같은 계정 체계로 붙는다.

### 구현 (Tier 1)

- 셸 서버가 OIDC 클라이언트다: authorization code + PKCE, state·nonce, `resource=<API>`로 API용 JWT
  access token, `offline_access` + `prompt=consent`로 refresh token. 토큰은 h3 sealed 세션 쿠키
  (`__Host-`, HttpOnly, SameSite=Lax) 안에만 있고 브라우저 JS·게임은 보지 못한다. 만료 1분 전에 갱신.
- 브라우저는 API를 직접 부르지 않는다. 셸 `/api/*`(BFF)가 세션 토큰을 붙여 API를 부르고, 상태를
  바꾸는 `/api` 요청은 같은 Origin만 받는다.
- API는 `iss`·`aud`·서명·만료를 검증하고 IdP `sub`를 내부 계정(uuid)에 매핑한다. 게임이 받는 건
  `{ id, nickname, avatar }`뿐이고 `sub`·역할·토큰은 나가지 않는다.
- 관리자 = 계정의 `admin` 역할. 첫 관리자는 `ADMIN_SUBS`(로그인 시 승격) 또는 `grant-admin`.
- 로컬 개발은 `pnpm dev:oidc`(oidc-provider)가 Logto를 대신한다. 셸은 표준 OIDC만 쓰므로 동작이 같다.

## 5. 게임 번들과 배포

### 번들 규칙 (템플릿에서 강제)

```
dist/
├─ index.html    # entry
├─ game.json     # 매니페스트 (빌드 시 version 주입)
├─ thumb.png
└─ assets/...
```

- 모든 경로 상대 경로 (Vite `base: './'`). 외부 리소스 로딩 금지 (CSP로도 강제). 크기 상한(기본 30MB,
  초과 시 승인).
- `.br`/`.gz` 사전 압축 파일은 업로드 시 `Content-Encoding` 메타데이터를 같이 설정한다.

### 스토리지와 도메인

```
games/<id>/<version>/...      ← 한 번 올리면 수정·삭제 금지
https://<id>.croffle-play.link/<version>/index.html
```

- 같은 버전 재업로드는 API가 거부. 고쳤으면 patch 버전.
- `Cache-Control: public, max-age=31536000, immutable`. Cloudflare Cache Rule로 전부 캐시.
- **origin은 게임 단위, 버전은 경로.** 같은 origin에 전 게임을 두면 localStorage/IndexedDB를 공유하고,
  `allow-same-origin`을 빼면 IndexedDB를 쓰는 엔진(Unity 등)이 깨진다. 버전까지 서브도메인에 넣으면
  업데이트마다 로컬 저장이 날아간다.
- **별도 등록 도메인**(`croffle-play.link`)인 이유: 같은 등록 도메인 아래면 게임이 상위 도메인 쿠키를
  심어 메인 세션을 오염시킬 수 있고(cookie tossing), Cloudflare 무료 인증서는 한 단계 와일드카드만
  지원한다. 외부 개발자에게 열 정도로 커지면 Public Suffix List 등록 검토.
- 예약 서브도메인: `www`, `api`, `admin`, `cdn`, `play`, `rooms`, `auth`, `static`, `preview`.

nginx 매핑 (개인 서버, 실제 규칙은 `infra/nginx/templates/game-domain.conf.template`):

- `<id>.croffle-play.link/<버전>/<경로>` → 버킷 `games`의 `<id>/<버전>/<경로>`. 디렉터리는 `index.html`.
  버전 없는 경로, 예약 서브도메인, GET/HEAD 외 메서드는 거부.
- **경로 순회 차단**: raw 경로에 `..`·`%2e`·`%2f`·`%5c`·`//`가 있으면 400. 막지 않으면
  `tetris.…/1.0.0/../../other/…`가 다른 게임의 코드를 tetris origin에서 실행해 그 게임의 로컬 저장소를
  읽을 수 있다.
- 응답: `Set-Cookie`·스토리지 헤더(CORS 포함) 제거, 게임별 CSP(`connect-src`는 룸 서버와 자기
  `<id>.srv.` 호스트만, `frame-ancestors`는 플랫폼 origin), `nosniff`, `no-referrer`. 성공 응답만 1년
  `immutable`, 오류는 `no-store`.
- 어댑터 호스트(`static.<플랫폼>`)는 `/adapters/v<N>/<버전>/{index.js,manifest.json}`만, CORS는 플랫폼
  origin만.

셸 CSP는 `frame-src`를 게임 도메인으로, `connect-src`를 어댑터 호스트로 제한하고
`frame-ancestors 'none'`이다(값은 env). 개발 환경도 게임마다 origin이 다르다(`http://<id>.localhost:4100`).

(Cloudflare Worker + R2 대안은 서버 다운과 무관하게 게임이 뜨고 egress가 무료지만, 파일 하나가 요청
1회라 무료 플랜 10만 req/일에 금방 닿는다. 당장은 개인 서버 + MinIO, 필요해지면 에셋만 R2로.)

### Publish 흐름

```
팀원: git tag v1.2.0 && git push --tags
  └─ CI: build → play-cli validate (매니페스트 스키마, 크기, CSP, SDK 상태)
       └─ play-cli publish: POST /games/:id/versions (게임별 배포 키)
            └─ API: SDK deprecated/eol이면 거부 → 버전 경로 전용 presigned URL 발급
                 └─ 업로드 → POST .../versions/:v/complete (파일 목록·해시 검증)
                      └─ preview 포인터 → 관리자 승인 → stable 포인터
```

- 배포 로직은 CLI에 두어 파이프라인 변경 시 워크플로 파일이 아니라 CLI 버전만 올린다.
- 배포 키는 게임별. 한 저장소 시크릿이 새도 다른 게임은 못 건드린다.
- `/game/:id/play?version=`(관리자), `/admin/games/:id/versions/:v`(미리보기 + 승인 버튼). 미리보기도
  같은 origin이라 로컬 저장은 실제 버전과 공유 — 필요하면 SDK 저장 API에 `channel` 네임스페이스.

## 6. 멀티플레이

- 통신은 **WebSocket** 기본. HTTP+SSE는 턴제만 가능하지만 하나로 통일하는 게 SDK가 단순. WebRTC
  DataChannel(시그널링·TURN 필요)과 WebTransport는 초기 제외.
- **공용 룸 서버** 하나로 대부분 해결: 방·인원 관리, 메시지 중계만. 로직은 클라이언트(방장). 게임별
  서버 불필요. Colyseus·Nakama 대신 **자체 `ws` 서버**(`apps/rooms`)로 결정 — 중계만 하므로 작고,
  메시지 형식을 `packages/protocol`(`rooms.ts`)이 직접 정의해 SDK 메이저와 함께 관리한다.
- 게임 iframe이 룸 서버에 **직접** 연결 (`wss://rooms.<플랫폼 도메인>`). 셸을 거쳐 postMessage로
  중계하지 않는다.
- SDK가 숨기는 것: 30초 ping(Cloudflare는 약 100초 무통신 시 끊음), 지수 백오프 재연결 + 같은 방
  재입장, `reconnecting` 이벤트. 인증은 연결 직후 **첫 메시지**로 토큰 전송(쿼리스트링 금지), 서버는
  `Origin` 헤더를 게임 도메인과 대조.
- 진짜 권위 서버가 필요한 게임만 **Tier 2 승인제**로 개별 컨테이너 허용.
- 구현 세부: 방 키는 `<게임>:<방>`, 방장은 가장 오래 있은 멤버(나가면 다음 사람), 프레임 16KB, 연결당
  초당 30개, 인증 5초, 상태는 메모리(단일 인스턴스). 토큰 `sub`는 공개 계정 id, `nickname` 클레임 포함
  → 룸 서버는 DB 없이 동작. 사용법은 [multiplayer.md](./multiplayer.md).

### 게임 서버 컨테이너 (Tier 2)

```yaml
services:
  game-tetris:
    image: ghcr.io/team-croffle/tetris-server:1.2.0
    networks: [games-net] # pg-net, redis-net 금지
    read_only: true
    user: '1000:1000'
    cap_drop: [ALL]
    security_opt: ['no-new-privileges:true']
    deploy:
      resources:
        limits: { cpus: '1.0', memory: 512M }
    restart: unless-stopped
```

- 리소스 제한 필수 (무한 루프 하나가 같은 머신의 팀 서비스를 죽인다).
- 저장할 데이터는 DB 직접 접근이 아니라 플랫폼 API로.
- 클라이언트 `game.json`에 `server.protocol`, 서버는 지원 범위 공개 → 한쪽만 배포/롤백해도 호환 유지.
- 구현: `game.json`의 `server.image`(팀 레지스트리, 태그·다이제스트 고정)가 publish 때 승인 요청이 되고,
  관리자가 승인하면 API가 승인 상태에서 위 형태의 compose 서비스를 **생성**한다(손으로 쓰지 않음 —
  DB 승인이 실행 정의의 원본). 주소는 `<id>.srv.croffle-play.link`(게임 도메인 쪽, 플랫폼 도메인
  쿠키에 닿지 않음), 게임은 `sdk.getServerInfo()`로 받는다. 자세한 절차는
  [game-servers.md](./game-servers.md).

## 7. 배치와 이전

- 개인 서버: 셸·API·룸·PostgreSQL·MinIO·nginx. 게임 서버 컨테이너는 SER7(32GB). 턴제·캐주얼 서버는
  컨테이너당 100MB 안팎이라 10개를 띄워도 1~2GB.
- 이식성: 스토리지는 S3 API만, 게임 도메인은 처음부터 분리, 전부 컨테이너 + 환경변수, IdP 데이터도
  Postgres.
- 한계 신호: 권위 서버 게임이 CPU를 상시 점유하거나 동접으로 팀 서비스가 느려지면 게임 서버만 먼저
  VPS로. AWS 전체 이전은 API 부하가 실제로 커졌을 때. 트래픽 대부분이 정적 파일이라 egress 비용이
  크므로 에셋은 R2(egress 무료)로 먼저.

## 8. 저장소 구성

```
croffle-play/   (이 저장소, 플랫폼 담당 관리)
├─ apps/shell  apps/api  apps/rooms  apps/adapters
├─ packages/protocol  packages/sdk  packages/cli  packages/create-game (게임 템플릿)
└─ infra/

<game>/               게임마다 독립 저장소 (`npm create @croffledev/play-game`으로 생성)
```

게임을 모노레포에 넣지 않는 이유: 엔진·빌드 자유, 게임 단위 권한, 플랫폼 CI가 게임 수에 비례하지
않음. 템플릿에는 `game.json`, `@croffledev/play-sdk` + 개발용 mock 호스트(플랫폼 없이 단독 실행),
배포 워크플로(태그 push → publish)가 들어간다.

게임 템플릿은 별도 GitHub 템플릿 저장소 대신 `packages/create-game`에 둔다(0.9.0에서 변경). SDK·CLI와 같은
릴리스로 버전이 맞춰지고, 이 저장소 CI가 템플릿에서 만든 게임을 워크스페이스 SDK로 실제 빌드·검증한다.
생성된 게임은 여전히 게임마다 독립 저장소다.

## 9. 진행 순서

1. **프로토콜/SDK 인터페이스 확정** — 플랫폼과 게임 사이의 계약, 나중에 바꾸기 가장 어렵다.
2. **게임 템플릿 + mock 호스트** — 팀원이 플랫폼과 병렬로 게임 개발을 시작할 수 있다.
3. **셸 + API 최소 기능** — 카탈로그, iframe 실행, 로그인.
4. **publish 파이프라인** — 처음엔 수동 업로드, 게임 3~4개쯤에서 자동화.

## 10. 기술 스택 (확정)

| 영역          | 선택                                                       | 이유                                                 |
| ------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| API           | NestJS + Fastify                                           | 모듈 구조, 가벼운 HTTP 계층                          |
| DB            | PostgreSQL + Drizzle (SQL 마이그레이션 `apps/api/drizzle`) | 스키마가 코드, 생성된 SQL을 그대로 리뷰·적용         |
| 테스트 DB     | PGlite (WASM Postgres)                                     | Docker 없이 실제 마이그레이션으로 테스트·로컬 실행   |
| 셸            | Nuxt (SSR) + Nitro 서버 라우트                             | 카탈로그 SEO, 브라우저는 API를 직접 부르지 않음(BFF) |
| 검증          | valibot                                                    | env·프로토콜·매니페스트 공용, SDK 번들 크기가 작다   |
| IdP           | Logto (OIDC, 셀프호스팅)                                   | 가볍고 Postgres 사용, 표준 OIDC라 교체 비용 낮음     |
| 룸 서버       | 자체 `ws` 서버 (중계만)                                    | 메시지 형식을 protocol 패키지가 직접 통제            |
| 플랫폼 도메인 | `play.croffledev.kr` (env로만 참조)                        | 게임 도메인 `croffle-play.link`와 다른 등록 도메인   |
