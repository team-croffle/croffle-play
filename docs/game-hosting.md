# 게임 호스팅과 등록

게임 작성자와 플랫폼 관리자를 위한 절차. 게임은 팀이 직접 호스팅하고, 포털은 그 주소를 iframe으로 띄운다.
설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md) §5.

## 1. 게임 등록 (관리자, 한 번)

관리자(`admin` 역할 계정)가 `/admin`에서 id와 이름으로 게임을 등록한다. id는 소문자·숫자·하이픈 1~32자이고,
예약어(`www`, `api`, `admin`, `cdn`, `play`, `rooms`, `auth`, `static`)는 쓸 수 없다. id가 곧 게임 주소의 첫
라벨이다: `https://<id>.play.croffle-play.link/`. 등록 직후에는 비공개다.

## 2. 호스팅 (게임 팀)

`npm create @croffledev/play-game`으로 만든 게임은 `pnpm build`로 `dist/`를 만든다. 정적 호스팅이면 무엇이든
되고, 템플릿의 `Dockerfile` + `Caddyfile`이 한 가지 예다. 호스트 이름(`<id>.play.croffle-play.link`)을 내 호스트로
연결하는 것은 관리자에게 요청한다.

호스트가 지켜야 할 것:

- `dist/`를 origin 루트에서 서빙한다. `game.json`이 `<origin>/game.json`에 있어야 한다.
- 포털만 iframe을 허용한다: `Content-Security-Policy: frame-ancestors https://www.croffle-play.link`.
  `X-Frame-Options: DENY`나 `SAMEORIGIN`은 보내지 않는다.
- https를 쓴다.
- 쿠키에 `Domain=croffle-play.link`를 붙이지 않는다(다른 게임과 포털로 퍼진다).

배포 전후 확인:

```bash
pnpm build && pnpm exec play-cli validate dist --api https://api.croffle-play.link
pnpm exec play-cli check https://<id>.play.croffle-play.link/ --portal https://www.croffle-play.link
```

`validate`는 `game.json` 스키마, 엔트리·썸네일 존재, SDK 메이저 상태(old·deprecated면 실패)를 본다. `check`는
배포된 게임이 https인지, 엔트리가 200인지, 포털이 iframe에 띄울 수 있는지, `game.json` id가 호스트와 맞는지 본다.

## 3. game.json 읽기와 공개 (관리자)

게임이 올라오면 관리자 화면에서 **game.json 다시 읽기** → **미리보기**(`/game/<id>/play?preview=1`) → **공개**.

- 포털은 `<origin>/game.json`을 읽어 id 일치와 SDK 메이저(current·lts)를 확인한다. 실패하면 사유가 관리자
  화면과 `/dev`에 남고, 이전에 읽은 값은 그대로 둔다.
- 공개(`listed`)하면 카탈로그에 나온다. 비공개로 돌리면 사라지지만 관리자는 계속 미리보기할 수 있다.

## 업데이트

- 콘텐츠 업데이트는 다시 배포하면 끝이다. 플랫폼에서 할 일이 없고, 플랫폼은 게임 버전을 추적하지 않는다.
- SDK 메이저를 올렸으면 관리자에게 game.json 다시 읽기를 요청한다. 실행에 쓰이는 어댑터는 게임이
  핸드셰이크로 알리는 메이저로 고른다.
- 쓰던 SDK 메이저가 old가 되면 GitHub 이슈와 `/dev` 경고가 온다. deprecated가 되면 게임은 목록에 "업데이트되지
  않음"으로 남고 실행되지 않는다. 절차: [sdk-lifecycle.md](./sdk-lifecycle.md).
