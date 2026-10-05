# 앱 환경 변수 레퍼런스

플랫폼 이미지 세 개(`api`, `rooms`, `shell`)가 받는 환경 변수 전부와, 앱 사이에 서로 맞아야 하는 값을 정리한다.
compose·프록시·DNS 같은 배포 설정은 이 저장소 밖의 일이라 다루지 않는다. 이미지는
`ghcr.io/team-croffle/croffle-play/<app>:<version>`이다.

예시 도메인: 포털 `game.croffle-play.link`, API `api.croffle-play.link`, 룸 `rooms.croffle-play.link`, 로그인(Logto)
`auth.croffle-play.link`, 게임 `<id>.play.croffle-play.link`. 코드는 도메인을 env로만 받는다.

로컬 개발용 예시는 각 앱의 `.env.example`에 있다.

## 공통

| 이름          | 기본값                                     | 설명                                                 |
| ------------- | ------------------------------------------ | ---------------------------------------------------- |
| `NODE_ENV`    | 이미지: `production`, 그 밖: `development` | `production`이면 아래의 production 검사가 켜진다     |
| `HOST`        | `0.0.0.0`                                  | 듣는 주소                                            |
| `PORT`        | api `3001`, rooms `3002`, shell `3000`     | 듣는 포트. 이미지의 `HEALTHCHECK`가 이 포트를 부른다 |
| `APP_VERSION` | 이미지 빌드 때 릴리스 버전                 | 이미지가 넣는 값. 직접 정하지 않는다                 |

## api

잘못된 값이 있으면 시작할 때 문제 있는 변수를 모두 적고 종료한다.

### 데이터베이스

| 이름                        | 필수 | 기본값  | 예                                                    | 설명                                                   |
| --------------------------- | ---- | ------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`              | 예   |         | `postgres://play:…@db:5432/croffle_play`              | PostgreSQL 주소. `pglite://memory`는 로컬 개발 전용    |
| `DB_POOL_SIZE`              |      | `10`    |                                                       | 연결 풀 크기                                           |
| `DB_MIGRATE`                |      | `true`  |                                                       | 시작할 때 마이그레이션 적용(`apps/api/drizzle`)        |
| `DB_SEED`                   |      | `false` |                                                       | 시작할 때 더미 카탈로그 넣기. 개발 전용                |
| `SEED_ADAPTER_MANIFEST_URL` |      |         | `http://localhost:4100/adapters/v1/dev/manifest.json` | `DB_SEED`와 함께: 이 어댑터를 SDK v1로 등록. 개발 전용 |

### 게임

| 이름                       | 필수 | 기본값                       | 예                                    | 설명                                                                     |
| -------------------------- | ---- | ---------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| `GAME_ORIGIN_TEMPLATE`     | 운영 | `http://{id}.localhost:4100` | `https://{id}.play.croffle-play.link` | 모든 게임의 origin. `{id}` 필수, 경로 없음. production은 `https://` 필수 |
| `GAME_MANIFEST_TIMEOUT_MS` |      | `5000`                       |                                       | 등록·새로고침 때 `<origin>/game.json`을 기다리는 시간(100 이상)          |

### 스토리지 (S3 API)

어댑터 번들(`adapters/`)과 아바타(`avatars/`)를 한 버킷에 둔다. 다섯 값이 없으면 스토리지 기능(어댑터 업로드,
아바타 업로드)이 꺼진다.

| 이름                   | 필수 | 기본값         | 예                         | 설명                    |
| ---------------------- | ---- | -------------- | -------------------------- | ----------------------- |
| `S3_ENDPOINT`          | 운영 |                | `https://s3.internal:9000` | S3 API 주소             |
| `S3_REGION`            |      | `us-east-1`    |                            |                         |
| `S3_ACCESS_KEY_ID`     | 운영 |                |                            | **비밀**                |
| `S3_SECRET_ACCESS_KEY` | 운영 |                |                            | **비밀**                |
| `S3_BUCKET`            |      | `croffle-play` |                            | 버킷은 미리 만들어 둔다 |

### 로그인 (OIDC)

| 이름            | 필수 | 기본값          | 예                                    | 설명                                                              |
| --------------- | ---- | --------------- | ------------------------------------- | ----------------------------------------------------------------- |
| `OIDC_ISSUER`   | 운영 |                 | `https://auth.croffle-play.link/oidc` | 플레이어 액세스 토큰의 발급자. 없으면 로그인이 꺼진다             |
| `OIDC_AUDIENCE` | 운영 |                 | `https://api.croffle-play.link`       | API 리소스 식별자 — 토큰의 `aud`                                  |
| `OIDC_JWKS_URL` |      | `<issuer>/jwks` | `http://logto:3001/oidc/jwks`         | JWKS를 내부 주소로 받을 때                                        |
| `ADMIN_SUBS`    |      | (없음)          | `abc123,def456`                       | 로그인하면 관리자로 올릴 IdP `sub` 목록(쉼표). 강등은 하지 않는다 |

### 게임 토큰 (JWKS)

게임 자체 서버와 룸 서버가 플레이어를 확인하는 단기 토큰(`aud: game:<id>`)이다. 공개 키는
`<PUBLIC_API_ORIGIN>/.well-known/jwks.json`에 나온다.

| 이름                     | 필수 | 기본값                  | 예                              | 설명                                                                      |
| ------------------------ | ---- | ----------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| `JWT_SIGNING_KEY`        | 운영 | 개발: 실행마다 새 키    |                                 | **비밀**. ES256 개인 키(PKCS8 PEM, `\n` 이스케이프 가능). production 필수 |
| `JWT_KEY_ID`             |      | `game-1`                |                                 | JWKS의 `kid`. 키를 바꿀 때 함께 바꾼다                                    |
| `PUBLIC_API_ORIGIN`      | 운영 | `http://localhost:3001` | `https://api.croffle-play.link` | API 공개 origin = 게임 토큰의 `iss`. production은 `https://` 필수         |
| `GAME_TOKEN_TTL_SECONDS` |      | `600`                   |                                 | 게임 토큰 수명, 60–900초                                                  |

서명 키 만들기:

```bash
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 | openssl pkcs8 -topk8 -nocrypt
```

### SDK 수명주기

| 이름                             | 필수 | 기본값                           | 설명                                                                                       |
| -------------------------------- | ---- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `SDK_LIFECYCLE_INTERVAL_SECONDS` |      | `3600`                           | 수명주기 동기화(예약된 old·deprecated 적용, 알림) 주기. `0`이면 끈다                       |
| `SDK_MIGRATION_GUIDE_URL`        |      | 저장소의 `docs/sdk-lifecycle.md` | 등록 거부·old 경고에 붙는 안내 링크                                                        |
| `GITHUB_NOTIFY_TOKEN`            |      |                                  | **비밀**. 게임 저장소에 이슈를 여는 fine-grained 토큰(Issues: write). 없으면 로그만 남긴다 |
| `GITHUB_API_URL`                 |      | `https://api.github.com`         | GitHub Enterprise일 때                                                                     |

### 기타

| 이름          | 기본값 | 설명                                                       |
| ------------- | ------ | ---------------------------------------------------------- |
| `RATE_LIMITS` | `true` | 쓰기 경로의 플레이어·키별 요청 제한. `false`는 테스트 전용 |

## rooms

공용 WebSocket 룸 서버. 첫 메시지로 게임 토큰을 받아 API의 JWKS로 확인하고, 연결의 `Origin`을 게임 origin
템플릿과 대조한다.

| 이름                      | 필수 | 기본값                                        | 예                                      | 설명                                                          |
| ------------------------- | ---- | --------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `JWKS_URL`                | 운영 | `http://localhost:3001/.well-known/jwks.json` | `http://api:3001/.well-known/jwks.json` | API의 JWKS. 내부 주소도 된다                                  |
| `TOKEN_ISSUER`            | 운영 | `http://localhost:3001`                       | `https://api.croffle-play.link`         | 게임 토큰의 `iss` — api의 `PUBLIC_API_ORIGIN`과 같은 값       |
| `ALLOWED_ORIGIN_TEMPLATE` | 운영 | `http://{id}.localhost:4100`                  | `https://{id}.play.croffle-play.link`   | 허용할 게임 origin. `{id}` 필수, production은 `https://` 필수 |

## shell (포털)

Nuxt 앱이라 `runtimeConfig` 키를 `NUXT_` 접두사 env로 받는다. 브라우저는 API를 직접 부르지 않고 포털 서버가
중계한다.

| 이름                      | 필수 | 기본값                  | 예                                    | 설명                                                                                                     |
| ------------------------- | ---- | ----------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `NUXT_SITE_URL`           | 운영 | `http://localhost:3000` | `https://game.croffle-play.link`      | 포털 공개 주소. OIDC 리디렉트 URI의 기준. `https://`면 `__Host-` 쿠키와 HSTS가 켜진다                    |
| `NUXT_API_BASE`           | 운영 | `http://localhost:3001` | `http://api:3001`                     | API 주소(포털 서버에서만 씀). 내부 주소면 된다                                                           |
| `NUXT_SESSION_PASSWORD`   | 운영 | 개발: 실행마다 새 값    |                                       | **비밀**. 세션 봉인 키, 32자 이상. 없으면 production에서 로그인 요청이 500                               |
| `NUXT_SESSION_MAX_AGE`    |      | `43200`                 |                                       | 세션 수명(초). 지나면 다시 로그인                                                                        |
| `NUXT_SESSION_REDIS_URL`  |      | (쿠키에 저장)           | `redis://valkey:6379/0`               | Redis 프로토콜 서버(예: Valkey)에 세션을 둔다. 비면 봉인된 쿠키에 담는다                                 |
| `NUXT_OIDC_ISSUER`        | 운영 |                         | `https://auth.croffle-play.link/oidc` | 비면 로그인이 꺼진다                                                                                     |
| `NUXT_OIDC_CLIENT_ID`     | 운영 |                         |                                       | Logto의 Traditional Web 앱                                                                               |
| `NUXT_OIDC_CLIENT_SECRET` | 운영 |                         |                                       | **비밀**                                                                                                 |
| `NUXT_OIDC_AUDIENCE`      | 운영 |                         | `https://api.croffle-play.link`       | 액세스 토큰을 받을 API 리소스 — api의 `OIDC_AUDIENCE`와 같은 값                                          |
| `NUXT_ROOMS_URL`          | 운영 | `ws://localhost:3002`   | `wss://rooms.croffle-play.link`       | 게임에 알려 주는 룸 서버 공개 주소                                                                       |
| `NUXT_CSP_FRAME_SRC`      | 운영 | (`pnpm dev:games`만)    | `https://*.play.croffle-play.link`    | iframe으로 띄울 게임 origin(CSP `frame-src`)                                                             |
| `NUXT_CSP_CONNECT_SRC`    |      |                         |                                       | 페이지가 더 접속할 origin(CSP `connect-src`). 어댑터는 같은 origin(`/adapters/…`)이라 운영에선 필요 없음 |

Logto 앱 설정: 리디렉트 URI `<NUXT_SITE_URL>/auth/callback`, 로그아웃 후 URI `<NUXT_SITE_URL>/`.

## 앱 사이에 맞아야 하는 값

| 무엇              | 값을 쓰는 곳                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| OIDC 발급자       | api `OIDC_ISSUER` = shell `NUXT_OIDC_ISSUER`                                                                     |
| API 리소스(`aud`) | api `OIDC_AUDIENCE` = shell `NUXT_OIDC_AUDIENCE` = Logto에 등록한 API 리소스                                     |
| 게임 토큰 발급자  | api `PUBLIC_API_ORIGIN` = rooms `TOKEN_ISSUER`, rooms `JWKS_URL` = `<api>/.well-known/jwks.json`                 |
| 게임 origin       | api `GAME_ORIGIN_TEMPLATE` = rooms `ALLOWED_ORIGIN_TEMPLATE`, shell `NUXT_CSP_FRAME_SRC`가 그 origin을 모두 포함 |
| 포털 → API        | shell `NUXT_API_BASE` → api `HOST`·`PORT`                                                                        |
| 포털 → 룸         | shell `NUXT_ROOMS_URL` → rooms 공개 주소                                                                         |
| 게임 → 포털       | 게임 호스트의 `frame-ancestors`에 `NUXT_SITE_URL`의 origin ([game-hosting.md](../game-hosting.md))               |

## 상태 확인

- api `GET /healthz`: DB에 `select 1`. 실패하면 503
- rooms `GET /healthz`
- shell: 별도 경로 없음. 이미지의 `HEALTHCHECK`는 `/`가 500 미만인지 본다
- 세 이미지 모두 `HEALTHCHECK`가 들어 있다

어댑터 등록(`sdk:register`)과 운영 절차는 [관리자 가이드](../guide/admin.md)에 있다.
