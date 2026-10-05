# Croffle Play 게임

`npm create @croffledev/play-game`으로 만든 [Croffle Play](https://github.com/team-croffle/croffle-play)
게임. 다음 순서로:

1. `game.json`의 id·이름을 확인하고 플랫폼 관리자에게 id 등록을 요청한다. 이 폴더를 게임 전용 GitHub
   저장소로 push한다.
2. `pnpm install && pnpm dev` — SDK mock 호스트(가짜 플레이어, 로컬 저장)로 단독 실행.
3. `src/`에서 자유롭게 만든다. 플랫폼과는 `@croffledev/play-sdk`로만 통신한다.

## 번들 규칙

- 모든 경로는 상대 경로(Vite `base: './'`), 다른 호스트에서 리소스 로딩 금지, 쿠키 금지.
- `dist/`에 `game.json`, 엔트리(`index.html`), 썸네일(`public/thumb.png`, 256×144 이상)이 있어야 한다.
  기본 크기 상한 30MB.
- 기능은 `sdk.has('score')`로 확인한다. 버전 비교 금지.

`pnpm build && pnpm validate`로 로컬에서 전부 확인할 수 있다.

## 배포

1. 플랫폼 관리자에게 게임의 **배포 키**를 받아 저장소 시크릿 `CROFFLE_PLAY_DEPLOY_KEY`로 등록하고,
   저장소 변수 `CROFFLE_PLAY_API`(예: `https://api.play.croffledev.kr`)를 설정한다.
2. 태그를 push한다: `git tag v1.0.0 && git push origin v1.0.0`.
3. **Publish** 워크플로가 빌드·검증·업로드한다. 관리자 미리보기를 거쳐 승인되면 공개된다. 버전은
   불변이라 수정은 새 태그로 한다.

SDK 업데이트는 Renovate가 올린다. 새 SDK 메이저에는 마이그레이션 가이드와 codemod가 함께 나온다.
