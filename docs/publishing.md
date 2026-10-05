# 게임 배포 가이드

게임 작성자와 플랫폼 관리자를 위한 배포 절차. 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md) §5.

## 한 번만: 게임 등록

1. 관리자(`admin` 역할 계정)가 `/admin`에서 게임을 등록한다. id는 소문자·숫자·하이픈 1~32자, 예약어(`www`, `api`,
   `admin`, `cdn`, `play`, `rooms`, `auth`, `static`, `preview`, `srv`) 제외. id가 곧 서브도메인이다
   (`<id>.croffle-play.link`).
2. 관리자가 게임 페이지에서 **배포 키**를 발급한다. 키는 발급 직후 한 번만 보이고, 플랫폼에는 해시만
   남는다. 게임마다 따로 발급하므로 한 저장소의 키가 새도 다른 게임은 건드릴 수 없다.
3. 게임 저장소(`npm create @croffledev/play-game`으로 생성)에 시크릿 `CROFFLE_PLAY_DEPLOY_KEY`, 변수 `CROFFLE_PLAY_API`를 설정한다.

## 매 버전: 태그 push

```bash
git tag v1.2.0 && git push origin v1.2.0
```

게임 저장소의 Publish 워크플로가 다음을 한다.

1. `pnpm build` — `dist/game.json`에 태그 버전을 넣는다.
2. `play-cli publish dist`
   - `validate`: `game.json` 스키마, 엔트리·썸네일 존재, 크기 상한(기본 30MB), 외부 리소스 참조,
     SDK 메이저 상태(deprecated/eol이면 실패, maintenance면 경고)
   - `POST /v1/games/:id/versions` — 파일 목록(크기·SHA-256)을 선언하고 파일별 presigned URL을 받는다.
     URL은 15분 유효, 그 파일의 경로·크기·해시·타입에만 쓸 수 있다.
   - 파일 업로드(동시 4개, 실패 시 재시도) → `POST …/:version/complete` — API가 저장된 객체를 하나씩
     대조하고, 맞으면 버전이 `uploaded`가 되고 preview 포인터가 이 버전으로 옮겨진다.
3. 관리자가 `/admin/games/<id>/versions/<버전>`에서 실제 플레이어로 미리보기 → **승인**하면 stable
   포인터가 옮겨지고 카탈로그에 노출된다. 반려하면 preview 포인터가 비워진다.

## 규칙

- **버전은 불변.** 완료된 버전은 다시 올릴 수 없다(409). 고치려면 새 버전을 태그한다. 업로드가 중간에
  실패해 완료되지 않은 버전은 같은 버전으로 다시 publish할 수 있다.
- **롤백은 포인터 이동.** 관리자 화면에서 이전에 승인된 버전을 골라 롤백한다. 아무것도 지우지 않는다.
- 30MB를 넘는 번들은 관리자가 게임별 상한을 올려야 한다(최대 200MB).
- `.br`/`.gz` 사전 압축 파일은 `Content-Encoding`과 함께 저장된다(Unity 등).

## 로컬 확인

```bash
pnpm build && pnpm exec play-cli validate dist --api https://api.play.croffledev.kr
```
