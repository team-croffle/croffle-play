# 보안 모델과 점검 기록

게임 코드는 신뢰하지 않는다는 전제에서, 경계마다 무엇을 막는지 정리한 문서. 마지막 점검: 0.10.0.

## 경계와 방어

| 경계               | 위협                                                        | 방어                                                                                                                                      | 위치                                                       |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 게임 ↔ 포털 세션   | 같은 사이트의 게임이 포털 쿠키를 받거나 덮어쓰기, 요청 위조 | 세션은 포털 서버에만, 쿠키 `__Host-`(Domain 없음)·HttpOnly·Lax. 상태 변경 `/api/*`는 포털 Origin만(없으면 403). API는 토큰 인증·CORS 없음 | `server/utils/session.ts`, `server/utils/request-guard.ts` |
| 게임 ↔ 게임        | 다른 게임의 코드가 내 origin에서 실행                       | 게임마다 origin(`<id>.play.<domain>`), 주소는 템플릿 + 검증된 id로만 만든다                                                               | `packages/protocol` `game-origin.ts`                       |
| 게임 호스트        | 포털 밖에서의 iframe 악용, 응답 헤더                        | 플랫폼이 강제할 수 없음 → 게임은 `frame-ancestors <포털>` 필수, `play-cli check`로 확인                                                   | `packages/cli`                                             |
| game.json 읽기     | API가 임의 호스트에 요청(SSRF)                              | 주소는 `GAME_ORIGIN_TEMPLATE` + id, 운영은 https, 리다이렉트 금지, 64KB·시간 제한                                                         | `admin/manifest-fetcher.ts`                                |
| postMessage        | 다른 창의 메시지 주입, 다른 origin으로 응답 유출            | SDK: `window.parent`만 수신, welcome origin 고정. 포털: iframe `contentWindow` **와** 게임 origin 둘 다 확인, 게임 origin으로만 전송      | `packages/sdk`, `apps/shell/app/utils/game-port.ts`        |
| 호스트 어댑터      | 변조된 어댑터가 포털 origin에서 실행                        | SRI(SHA-384) 검증 후 Blob URL import. 포털 같은 origin `/adapters/…` → API → 스토리지(비공개)                                             | `adapter-loader.ts`, `sdk/adapters.controller.ts`          |
| 로그인             | 코드 가로채기, 오픈 리다이렉트                              | PKCE(S256)·state·nonce, 복귀 경로는 같은 사이트 경로만                                                                                    | `server/routes/auth`                                       |
| API 토큰           | 다른 API용 토큰 재사용                                      | `iss`·`aud`(API 리소스)·서명·만료 검증                                                                                                    | `auth/jwt-verifier.ts`                                     |
| 게임 토큰          | 탈취 토큰으로 다른 게임·플랫폼 접근                         | `aud: game:<id>`, 10분(최대 15분), postMessage로만 전달                                                                                   | `tokens/*`                                                 |
| 룸 서버            | 다른 게임 사칭, 남용                                        | 게임 id는 토큰에서, Origin = 그 게임 origin, 첫 메시지 인증 5초, 16KB·30msg/s                                                             | `apps/rooms`                                               |
| 게임 서버 (Tier 2) | 플랫폼 내부 침투, 자원 독점                                 | 승인제, 팀 레지스트리 이미지 고정, `games-net`만, read-only·비루트·`cap_drop: ALL`·자원 제한, 공개 API만 사용                             | `game-servers/compose.ts` (v0.11에서 교체)                 |
| 점수               | 브라우저에서 임의 점수                                      | `client` 정책은 "검증되지 않음" 표기, `server` 정책은 서버 키(`csk_`) 제출만, 범위 검사                                                   | `scores/*`, `server-keys/*`                                |
| 남용               | 반복 요청                                                   | 쓰기 라우트 주체별 한도(사용자·키), 429 + Retry-After                                                                                     | `common/rate-limit.ts`                                     |

## 응답 헤더

- 포털: CSP(`frame-src` 게임 origin, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`),
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  (카메라·마이크·위치·결제·USB 차단), https면 HSTS.
- API: `nosniff`, `CSP: default-src 'none'; frame-ancestors 'none'`, `no-referrer`, 인증 요청은 `no-store`.
  어댑터는 immutable 캐시.
- 게임: 게임 호스트가 정한다. 필수는 `frame-ancestors <포털>`. 템플릿 `Caddyfile`은 여기에 `nosniff`·
  `no-referrer`·캐시 규칙을 더한다.

## iframe

`sandbox="allow-scripts allow-same-origin allow-pointer-lock"`, `allow="fullscreen; autoplay; gamepad"`,
`referrerpolicy="no-referrer"`. 게임 origin은 포털 origin과 다르므로 `allow-same-origin`은 게임 자기 origin의
저장소(IndexedDB 등)만 열어 준다. 팝업·폼 전송·최상위 이동·다운로드는 허용하지 않는다.

## 알려진 한계 (의도적으로 남긴 것)

- 포털과 게임은 같은 사이트(`croffle-play.link`)다. SameSite 쿠키는 게임발 요청을 막지 못하므로 위의 Origin
  검사와 `__Host-` 쿠키가 방어선이다. 게임끼리도 같은 사이트라 서로 사이트 범위 쿠키를 심을 수 있다(포털 세션과는
  무관).
- 게임 호스트의 응답(CSP, 쿠키)은 플랫폼이 통제하지 못한다. 등록 전 `play-cli check`와 관리자 미리보기로 확인한다.
- 포털 CSP의 `script-src 'unsafe-inline'`: Nuxt SSR 페이로드가 인라인이다. nonce 지원이 들어오면 바꾼다.
- `script-src blob:`: SRI 검증한 어댑터를 Blob URL로 import하기 위해 필요. XSS가 선행 조건이다.
- 요청 제한·룸 상태는 메모리(단일 인스턴스). 인스턴스를 늘리면 공유 저장소가 필요하다.

## 보고

보안 문제는 공개 이슈 대신 저장소 관리자에게 비공개로 알린다(GitHub Security Advisories).
