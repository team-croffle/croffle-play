# 게임 개발자 가이드

Croffle Play에 게임을 올리는 처음부터 끝까지. 게임은 **내 저장소에서 내 마음대로** 만들고 **직접 호스팅**한다.
플랫폼(포털)은 게임을 iframe으로 띄우고, 로그인·점수·저장·멀티플레이를 SDK로 제공한다.

```
템플릿 생성 → SDK로 플랫폼 기능 사용 → mock으로 로컬 개발 → 빌드·validate
→ <id>.play.croffle-play.link에 호스팅 → play-cli check → 관리자에게 등록 요청 → 공개
```

각 단계의 자세한 내용은 아래 링크로 이어진다. API 하나하나는 [SDK 레퍼런스](../reference/sdk.md)에 있다.

## 0. 준비물

- Node 24 이상, pnpm(템플릿이 버전을 고정한다 — `corepack enable`)
- 게임 id 하나: 소문자·숫자·하이픈 1–32자, 예약어(`www`, `api`, `admin`, `cdn`, `play`, `rooms`, `auth`,
  `static`) 제외. id가 게임 주소 `https://<id>.play.croffle-play.link/`가 된다. 관리자에게 미리 확인한다.
- 게임을 올릴 GitHub 저장소(게임마다 하나, 팀 소유)

## 1. 생성

```bash
npm create @croffledev/play-game my-game
cd my-game
pnpm install
pnpm dev        # SDK mock 호스트로 단독 실행
```

| 파일·폴더                    | 무엇                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| `game.json`                  | 게임이 플랫폼에 알리는 정보(아래)                                          |
| `src/platform.ts`            | SDK 연결. 플랫폼 안이면 진짜 호스트, 밖이면 mock                           |
| `src/main.ts`                | 예제 게임 — 마음대로 바꾼다                                                |
| `public/thumb.png`           | 카탈로그 썸네일(권장 256×144 이상, 512KB 이하, png·jpg·webp)               |
| `scripts/write-manifest.mjs` | 빌드 때 `dist/game.json`에 버전을 넣는다(`GAME_VERSION` 또는 package.json) |
| `Dockerfile`, `Caddyfile`    | 호스팅 예시 하나(필수 아님)                                                |
| `.github/workflows/ci.yml`   | typecheck·build·validate                                                   |

엔진은 자유다. Vite 예제를 지우고 다른 엔진의 웹 빌드를 써도 된다. 지켜야 할 것은 `dist/`(최종 산출물)
루트에 `game.json`과 엔트리 HTML이 있고, 게임 코드가 SDK를 번들에 넣는 것뿐이다.

### `game.json`

```json
{
  "id": "my-game",
  "name": "My Game",
  "entry": "index.html",
  "thumbnail": "thumb.png",
  "sdk": "^1.0.0",
  "orientation": "landscape"
}
```

| 필드          | 필수 | 설명                                                                                      |
| ------------- | ---- | ----------------------------------------------------------------------------------------- |
| `id`          | 예   | 게임 id. 호스트 이름과 같아야 한다                                                        |
| `name`        | 예   | 1–60자                                                                                    |
| `sdk`         | 예   | 쓰는 SDK의 범위, 메이저 하나(`^1.2.0`, `1.x`). 플랫폼은 이 메이저로 등록 가능 여부를 본다 |
| `entry`       |      | 엔트리 문서, 기본 `index.html`                                                            |
| `thumbnail`   |      | 썸네일 경로                                                                               |
| `orientation` |      | `landscape` · `portrait` · `any`(기본)                                                    |
| `version`     |      | 게임 자체 버전(참고용). 빌드 스크립트가 넣는다                                            |
| `server`      |      | 게임 자체 서버 `{ url, protocol }` — [game-servers.md](../game-servers.md)                |

## 2. SDK로 플랫폼 기능 쓰기

```ts
import { connect } from './platform';

const sdk = await connect();
await sdk.ready(); // 로딩 화면 걷기

const user = await sdk.getUser(); // 게스트면 null
if (sdk.has('score')) await sdk.submitScore(score);
if (sdk.has('save')) await sdk.save('slot1', JSON.stringify(state));
sdk.on('pause', () => game.pause());
sdk.on('resume', () => game.resume());
```

- 기능은 `sdk.has(...)`로 확인한다. 버전을 비교하지 않는다.
- 로그인이 필요한 호출(점수, 저장, 토큰)을 게스트가 하면 `auth_required`로 거부되고 포털이 로그인 창을 띄운다.
  게임은 게스트로도 끝까지 플레이되게 만든다.
- 게임은 플랫폼 세션이나 토큰을 갖지 않는다. 받는 것은 공개 프로필(id, 닉네임, 아바타)뿐이다.

메서드·이벤트·오류 코드 전체: [SDK 레퍼런스](../reference/sdk.md).

## 3. 로컬 개발

`pnpm dev`는 mock 호스트로 돈다: 가짜 플레이어 `Player`, 저장은 localStorage, 점수는 `host.scores`에 쌓인다.
게스트·기능 제한을 흉내 내려면 `src/platform.ts`에서 `createMockHost({ user: null, capabilities: [...] })`.

멀티플레이(`rooms`)·토큰(`token`)·자체 서버(`server`)는 진짜 플랫폼이 필요하다. 플랫폼 저장소를 받아 로컬 스택을
띄우고 게임을 그 위에서 연다 — [multiplayer.md](../multiplayer.md#로컬-개발).

## 4. 빌드와 검사

```bash
pnpm build                        # dist/ + dist/game.json
pnpm validate                     # play-cli validate dist
pnpm exec play-cli validate dist --api https://api.croffle-play.link   # SDK 메이저 상태까지
```

`validate`는 `game.json` 스키마, 엔트리·썸네일 존재, (`--api`가 있으면) SDK 메이저가 old·deprecated가 아닌지
본다. 템플릿 CI가 PR마다 같은 검사를 돈다.

## 5. 호스팅

게임 주소는 `https://<id>.play.croffle-play.link/`이다. 이 이름을 내 호스트로 연결하는 것은 관리자에게 요청한다.
정적 호스팅이면 무엇이든 된다. 호스트가 지켜야 할 것:

- `dist/`를 origin 루트에서 서빙한다. `<origin>/game.json`이 열려야 한다.
- 포털만 iframe을 허용한다: `Content-Security-Policy: frame-ancestors https://game.croffle-play.link`.
  `X-Frame-Options: DENY`·`SAMEORIGIN`은 보내지 않는다.
- https.
- 쿠키에 `Domain=croffle-play.link`를 붙이지 않는다(포털·다른 게임으로 퍼진다).

템플릿의 `Dockerfile` + `Caddyfile`이 이 조건을 모두 지킨다:

```bash
docker build -t my-game .
docker run -p 8080:8080 -e PORTAL_ORIGIN=https://game.croffle-play.link my-game
```

자세히: [game-hosting.md](../game-hosting.md).

## 6. 배포 확인

```bash
pnpm exec play-cli check https://my-game.play.croffle-play.link/ --portal https://game.croffle-play.link
```

`check`는 포털이 쓰는 방식 그대로 본다: https, 엔트리 200, 포털이 iframe에 띄울 수 있는지(`frame-ancestors`),
`game.json`이 유효하고 id가 호스트 이름과 같은지.

## 7. 등록과 공개

관리자에게 다음을 전한다:

- 게임 id와 이름, 저장소 주소
- `play-cli check`가 통과한 주소
- (있으면) 자체 서버 여부와 점수 정책(브라우저 점수 / 서버 점수만)
- 함께 개발할 팀원(포털 계정) — 게임 멤버로 추가되면 포털 `/dev`에서 내 게임의 상태를 본다

관리자가 등록 → `game.json` 읽기 → 미리보기 → 공개하면 카탈로그에 나온다([관리자 가이드](./admin.md)).
읽기에 실패하면 사유가 `/dev`에 보인다.

## 8. 그다음

- **콘텐츠 업데이트**: 다시 배포하면 끝. 플랫폼은 게임 버전을 추적하지 않는다.
- **SDK 업데이트**: Renovate가 PR을 연다. 메이저를 올렸으면 관리자에게 `game.json` 다시 읽기를 요청한다.
  쓰던 메이저가 old가 되면 GitHub 이슈와 `/dev` 경고가 오고, deprecated가 되면 게임이 실행되지 않는다 —
  [sdk-lifecycle.md](../sdk-lifecycle.md).
- **멀티플레이**: 공용 룸 서버 — [multiplayer.md](../multiplayer.md).
- **권위 서버·영구 상태**: 게임 자체 서버 — [game-servers.md](../game-servers.md).
- **보안 모델**: [security.md](../security.md).
