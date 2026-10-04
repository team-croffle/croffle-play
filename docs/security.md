# 보안 모델과 점검 기록

게임 코드는 신뢰하지 않는다는 전제에서, 경계마다 무엇을 막는지 정리한 문서. 마지막 전수 점검: 0.9.0.

## 경계와 방어

| 경계               | 위협                                                    | 방어                                                                                                                               | 위치                                                |
| ------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 게임 ↔ 플랫폼 세션 | 게임이 플랫폼 쿠키를 심거나 사용자 권한으로 API 호출    | 게임은 다른 등록 도메인(`croffle-play.link`), 세션은 셸 서버에만(`__Host-`, HttpOnly, Lax), API는 CORS 없음                        | ARCHITECTURE §4·§5                                  |
| 게임 ↔ 게임        | 다른 게임의 코드가 내 origin에서 실행(로컬 저장소 탈취) | 게임별 서브도메인, nginx가 raw 경로의 `..`·`%2e`·`%2f`·`%5c`·`//` 거부                                                             | `infra/nginx/templates`                             |
| 게임 번들          | 외부 스크립트 로딩, 쿠키                                | 게임 도메인 CSP(`self`·`blob:`·룸·자기 `.srv`만), `Set-Cookie` 제거, `frame-ancestors` = 플랫폼                                    | nginx                                               |
| postMessage        | 다른 창의 메시지 주입, 다른 origin으로 응답 유출        | SDK: `window.parent`만 수신, welcome origin 고정. 셸: iframe `contentWindow` **와** 게임 origin 둘 다 확인, 게임 origin으로만 전송 | `packages/sdk`, `apps/shell/app/utils/game-port.ts` |
| 호스트 어댑터      | 변조된 어댑터가 셸 origin에서 실행                      | SRI(SHA-384) 검증 후 Blob URL import, 어댑터 호스트는 플랫폼 origin에만 CORS                                                       | `adapter-loader.ts`                                 |
| 셸 BFF             | CSRF                                                    | 상태 변경 `/api/*`는 같은 Origin만(없으면 403), 쿠키 SameSite=Lax, 로그아웃도 POST                                                 | `server/middleware/same-origin.ts`                  |
| 로그인             | 코드 가로채기, 오픈 리다이렉트                          | PKCE(S256)·state·nonce, 복귀 경로는 같은 사이트 경로만                                                                             | `server/routes/auth`                                |
| API 토큰           | 다른 API용 토큰 재사용                                  | `iss`·`aud`(API 리소스)·서명·만료 검증                                                                                             | `auth/jwt-verifier.ts`                              |
| 게임 토큰          | 탈취 토큰으로 다른 게임·플랫폼 접근                     | `aud: game:<id>`, 10분(최대 15분), postMessage로만 전달                                                                            | `tokens/*`                                          |
| 룸 서버            | 다른 게임 사칭, 남용                                    | 게임 id는 토큰에서, Origin = 그 게임 도메인, 첫 메시지 인증 5초, 16KB·30msg/s                                                      | `apps/rooms`                                        |
| 게임 서버 (Tier 2) | 플랫폼 내부 침투, 자원 독점                             | 승인제, 팀 레지스트리 이미지 고정, `games-net`만, read-only·비루트·`cap_drop: ALL`·자원 제한, 공개 API만 사용                      | `game-servers/compose.ts`                           |
| publish            | 버전 덮어쓰기, 남의 게임 업로드, 큰 번들                | 버전 불변(409), 게임별 배포 키(해시 저장·회전), presigned URL = 파일 하나·크기·SHA-256 고정                                        | `publish/*`                                         |
| 점수               | 브라우저에서 임의 점수                                  | `client` 정책은 "검증되지 않음" 표기, `server` 정책은 서버 키 제출만, 범위 검사                                                    | `scores/*`                                          |
| 남용               | 반복 요청                                               | 쓰기 라우트 주체별 한도(사용자·키), 429 + Retry-After                                                                              | `common/rate-limit.ts`                              |

## 응답 헤더

- 셸: CSP(`frame-src` 게임 도메인, `connect-src` 어댑터 호스트, `frame-ancestors 'none'`, `object-src 'none'`),
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy`(카메라·마이크·위치·결제·USB 차단), https면 HSTS.
- API: `nosniff`, `CSP: default-src 'none'; frame-ancestors 'none'`, `no-referrer`, 인증 요청은 `no-store`.
- 게임 도메인: 위 "게임 번들" 행. 어댑터 호스트: `nosniff`, 플랫폼 origin CORS, immutable.

## iframe

`sandbox="allow-scripts allow-same-origin allow-pointer-lock"`, `allow="fullscreen; autoplay; gamepad"`,
`referrerpolicy="no-referrer"`. 게임이 다른 등록 도메인이라 `allow-same-origin`은 게임 자기 origin의
저장소(IndexedDB 등)만 열어 준다. 팝업·폼 전송·최상위 이동·다운로드는 허용하지 않는다.

## 알려진 한계 (의도적으로 남긴 것)

- 셸 CSP의 `script-src 'unsafe-inline'`: Nuxt SSR 페이로드가 인라인이다. nonce 지원이 들어오면 바꾼다.
  셸에는 사용자 HTML을 렌더링하는 곳이 없어 XSS 표면은 작다.
- `script-src blob:`: SRI 검증한 어댑터를 Blob URL로 import하기 위해 필요. Blob은 셸 origin의 스크립트만
  만들 수 있으므로 XSS가 선행 조건이다.
- 요청 제한·룸 상태는 메모리(단일 인스턴스). 인스턴스를 늘리면 공유 저장소가 필요하다.
- 게임 도메인 서브도메인끼리는 같은 site다(쿠키는 막지만 SameSite 판정은 공유) → 외부 개발자에게 열기
  전에 [Public Suffix List](./public-suffix.md) 등록을 검토한다(현재 결정: 외부 개방 전에 등록).

## 보고

보안 문제는 공개 이슈 대신 저장소 관리자에게 비공개로 알린다(GitHub Security Advisories).
