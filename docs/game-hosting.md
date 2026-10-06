# 게임 호스팅과 등록

게임 작성자와 플랫폼 관리자를 위한 절차. 게임은 `https://<id>.play.croffle-play.link/`에서 열리고, 포털은 그
주소를 iframe으로 띄운다. 그 주소를 채우는 방법은 둘이다 — **팀 호스팅**(팀이 직접 서빙) 또는 **플랫폼
호스팅**(빌드를 zip으로 올리면 플랫폼의 게임 호스트가 서빙). 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md) §5.

처음부터 끝까지의 흐름은 [게임 개발자 가이드](./guide/developer.md)에 있다.

## 1. 게임 등록 (관리자, 한 번)

관리자(`admin` 역할 계정)가 `/admin`에서 id와 이름으로 게임을 등록한다. id는 소문자·숫자·하이픈 1~32자이고,
예약어(`www`, `api`, `admin`, `cdn`, `play`, `rooms`, `auth`, `static`)는 쓸 수 없다. id가 곧 게임 주소의 첫
라벨이다: `https://<id>.play.croffle-play.link/`. 등록 직후에는 비공개다.

## 2. 호스팅 (게임 팀)

`npm create @croffledev/play-game`으로 만든 게임은 `pnpm build`로 `dist/`를 만든다. 그다음 두 방법 중 하나다.

### 2a. 플랫폼 호스팅 (zip 업로드)

빌드를 올리면 플랫폼이 `<id>.play.croffle-play.link`에서 서빙한다. 서버·DNS 작업이 없다.

- **포털에서**: 관리자는 `/admin/games/<id>`, 게임 멤버는 `/dev`에서 zip을 올린다. 올리면 바로 그 빌드가
  서비스된다. 최근 5개가 남아 이전 빌드로 **되돌리기**할 수 있다.
- **CLI·CI에서**: 관리자나 멤버가 발급한 **배포 키**(`cdk_…`, 그 게임에만 올릴 수 있음)로:
  ```bash
  pnpm exec play-cli pack dist                 # 검사 + <id>.zip (선택)
  CROFFLE_DEPLOY_KEY=cdk_… pnpm exec play-cli deploy dist --api https://api.croffle-play.link
  ```
  템플릿의 `.github/workflows/deploy.yml`은 저장소 secret `CROFFLE_DEPLOY_KEY`와 variable `CROFFLE_PLAY_API`가
  있으면 `main`에 push할 때마다 같은 일을 한다. 키는 env로만 넘기고 인자나 로그에 두지 않는다.

zip 규칙: 루트(또는 폴더 하나 안)에 `game.json`, 그 `id`가 등록된 id와 같아야 하고 `entry` 파일이 있어야 한다.
기본 상한은 zip 100 MB, 해제 300 MB, 파일 2,000개, 파일 하나 50 MB(운영자가 env로 조정). `..`·절대 경로·역슬래시·
심볼릭 링크가 있으면 거부된다. 플랫폼이 `frame-ancestors`·`nosniff` 헤더를 붙이므로 팀이 신경 쓸 것이 없다.
`game.json`은 zip 안의 것을 쓰므로 "다시 읽기"가 없다 — 새로 올리면 바뀐다.

### 2b. 팀 호스팅

정적 호스팅이면 무엇이든 되고, 템플릿의 `Dockerfile` + `Caddyfile`이 한 가지 예다. 호스트 이름
(`<id>.play.croffle-play.link`)을 내 호스트로 연결하는 것은 관리자에게 요청한다.

호스트가 지켜야 할 것:

- `dist/`를 origin 루트에서 서빙한다. `game.json`이 `<origin>/game.json`에 있어야 한다.
- 포털만 iframe을 허용한다: `Content-Security-Policy: frame-ancestors https://game.croffle-play.link`.
  `X-Frame-Options: DENY`나 `SAMEORIGIN`은 보내지 않는다.
- https를 쓴다.
- 쿠키에 `Domain=croffle-play.link`를 붙이지 않는다(다른 게임과 포털로 퍼진다).

배포 전후 확인:

```bash
pnpm build && pnpm exec play-cli validate dist --api https://api.croffle-play.link
pnpm exec play-cli check https://<id>.play.croffle-play.link/ --portal https://game.croffle-play.link
```

`validate`는 `game.json` 스키마, 엔트리·썸네일 존재, SDK 메이저 상태(old·deprecated면 실패)를 본다. `check`는
배포된 게임이 https인지, 엔트리가 200인지, 포털이 iframe에 띄울 수 있는지, `game.json` id가 호스트와 맞는지 본다.

## 3. game.json 읽기와 공개 (관리자)

게임이 올라오면 관리자 화면에서 **game.json 다시 읽기**(팀 호스팅만) → **미리보기**(`/game/<id>/play?preview=1`)
→ **공개**.

- 팀 호스팅: 포털은 `<origin>/game.json`을 읽어 id 일치와 SDK 메이저(current·lts)를 확인한다. 실패하면 사유가
  관리자 화면과 `/dev`에 남고, 이전에 읽은 값은 그대로 둔다.
- 플랫폼 호스팅: 업로드 때 zip의 `game.json`을 같은 규칙으로 검사해 저장한다. 호스팅 방식은 관리자 화면에서
  팀 ↔ 플랫폼으로 바꿀 수 있다(플랫폼으로 바꾸려면 올린 빌드가 있어야 한다).
- 공개(`listed`)하면 카탈로그에 나온다. 비공개로 돌리면 사라지지만 관리자는 계속 미리보기할 수 있다.

## 업데이트

- 콘텐츠 업데이트는 다시 배포(팀 호스팅)하거나 다시 올리면(플랫폼 호스팅) 끝이다. 플랫폼은 그 외의 게임 버전을
  추적하지 않는다. 플랫폼 호스팅은 최근 5개 업로드를 보관해 되돌릴 수 있다.
- SDK 메이저를 올렸으면 팀 호스팅은 관리자에게 game.json 다시 읽기를 요청하고, 플랫폼 호스팅은 새로 올리면 된다. 실행에 쓰이는 어댑터는 게임이
  핸드셰이크로 알리는 메이저로 고른다.
- 쓰던 SDK 메이저가 old가 되면 GitHub 이슈와 `/dev` 경고가 온다. deprecated가 되면 게임은 목록에 "업데이트되지
  않음"으로 남고 실행되지 않는다. 절차: [sdk-lifecycle.md](./sdk-lifecycle.md).
