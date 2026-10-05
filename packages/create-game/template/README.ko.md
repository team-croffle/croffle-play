# Croffle Play 게임

`npm create @croffledev/play-game`으로 만든 [Croffle Play](https://github.com/team-croffle/croffle-play)
게임. 플레이어는 포털에서 이 게임을 연다. 포털이 iframe으로 게임을 띄우고, `@croffledev/play-sdk`를 통해
플랫폼 계정·점수·저장·룸을 제공한다.

1. `game.json`의 id·이름을 확인하고 이 폴더를 게임 전용 GitHub 저장소로 push한다.
2. `pnpm install && pnpm dev` — SDK mock 호스트(가짜 플레이어, 로컬 저장)로 단독 실행.
3. `src/`에서 자유롭게 만든다. 플랫폼과는 SDK로만 통신하고, 기능은 `sdk.has('score')`로 확인한다(버전
   비교 금지).

## 호스팅

게임은 직접 호스팅한다. 주소는 `https://<id>.play.croffle-play.link/`이다(이 이름을 내 호스트로 연결해
달라고 플랫폼 관리자에게 요청). 정적 호스팅이면 무엇이든 된다. 여기 있는 `Dockerfile` + `Caddyfile`은 그중
한 방법이다.

호스트가 지켜야 할 것:

- `dist/`를 origin 루트에서 서빙하고 `game.json`도 포함한다(포털이 읽는다).
- 포털이 게임을 iframe에 띄울 수 있게 한다: `Content-Security-Policy: frame-ancestors https://game.croffle-play.link`
  (`Caddyfile`이 이렇게 한다). `X-Frame-Options: DENY`는 보내지 않는다.
- https를 쓴다.

배포 전후 확인:

```bash
pnpm build && pnpm validate                       # game.json, 엔트리, 썸네일(public/thumb.png)
pnpm exec play-cli check https://<id>.play.croffle-play.link/ --portal https://game.croffle-play.link
```

그다음 플랫폼 관리자에게 게임 등록을 요청한다. 새 SDK 메이저로 올렸을 때만 관리자가 `game.json`을 다시
읽으면 되고, 콘텐츠 업데이트는 플랫폼에서 할 일이 없다.

SDK 업데이트는 Renovate가 올린다. 새 SDK 메이저에는 마이그레이션 가이드와 codemod가 함께 나온다.

## 명령

| 명령             | 하는 일                                                 |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | SDK mock 호스트로 단독 실행                             |
| `pnpm build`     | `dist/` 빌드, `dist/game.json` 작성                     |
| `pnpm preview`   | `dist/`를 로컬에서 서빙                                 |
| `pnpm typecheck` | TypeScript 검사                                         |
| `pnpm validate`  | `play-cli validate dist`: game.json, 엔트리, SDK 메이저 |

## 문서

- [게임 개발자 가이드](https://github.com/team-croffle/croffle-play/blob/master/docs/guide/developer.md) — 이 템플릿에서 공개된 게임까지
- [SDK 레퍼런스](https://github.com/team-croffle/croffle-play/blob/master/docs/reference/sdk.md)
- [호스팅과 등록](https://github.com/team-croffle/croffle-play/blob/master/docs/game-hosting.md) · [멀티플레이](https://github.com/team-croffle/croffle-play/blob/master/docs/multiplayer.md) ·
  [게임 자체 서버](https://github.com/team-croffle/croffle-play/blob/master/docs/game-servers.md) · [SDK 수명주기](https://github.com/team-croffle/croffle-play/blob/master/docs/sdk-lifecycle.md)
