# 관리자 가이드

플랫폼 관리자가 게임을 등록·공개하고, 게임 서버 키·멤버·점수 정책을 관리하고, SDK 메이저와 호스트 어댑터를
운영하는 방법. 이미지를 띄우는 env는 [env 레퍼런스](../reference/env.md), 게임 팀 쪽 절차는
[게임 개발자 가이드](./developer.md)에 있다.

## 관리자 권한

관리자는 계정의 역할(`admin`)이다. api의 `ADMIN_SUBS`에 IdP subject(Logto 사용자 id)를 쉼표로 적어 두면 그
계정이 로그인할 때 관리자로 올라간다. 목록에서 빼도 강등되지는 않는다(강등은 DB에서).

관리 화면은 포털의 `/admin`이다. 포털이 출처를 확인한 요청만 API로 중계하고, API는 관리자 토큰을 확인한다.

## 게임 등록부터 공개까지

1. **등록** — `/admin` → 새 게임에 id와 이름. id는 소문자·숫자·하이픈 1–32자, 예약어(`www`, `api`, `admin`,
   `cdn`, `play`, `rooms`, `auth`, `static`) 불가. id가 게임 주소 `https://<id>.play.croffle-play.link/`의 첫
   라벨이다. 등록 직후에는 비공개다.
2. **주소 연결** — 게임 팀의 호스트로 `<id>.play.croffle-play.link`를 연결한다(DNS·프록시, 저장소 밖 운영 일).
3. **배포 확인** — 팀이 배포하면 `play-cli check`로 확인한다:
   ```bash
   npx @croffledev/play-cli check https://<id>.play.croffle-play.link/ --portal https://game.croffle-play.link
   ```
4. **game.json 다시 읽기** — `/admin/games/<id>`에서. 포털이 `<origin>/game.json`을 읽어 id 일치와 SDK 메이저
   (current·lts만)를 확인한다. 실패하면 사유가 화면과 팀의 `/dev`에 남고, 이전에 읽은 값은 그대로다.
5. **미리보기** — `/game/<id>/play?preview=1`. 비공개 게임은 관리자만 열 수 있다. 로딩·핸드셰이크·점수가
   되는지 본다.
6. **공개** — 카탈로그에 나온다. **비공개로** 돌리면 사라지지만 미리보기는 계속 된다.

게임 콘텐츠 업데이트에는 할 일이 없다. 팀이 SDK 메이저를 올렸거나 `game.json`의 `server`를 바꿨을 때만
다시 읽는다.

## 게임 설정 (`/admin/games/<id>`)

| 항목         | 내용                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| 기본 정보    | 이름                                                                                                           |
| 멤버         | 게임 팀원(포털 계정). 역할 `owner`·`developer`. 멤버는 `/dev`에서 게임 상태·SDK 경고·읽기 실패 사유를 본다     |
| 점수         | 정책 `client`(브라우저 점수, 미검증 표시) 또는 `server`(게임 서버가 서버 키로 낸 점수만), 허용 범위(최소·최대) |
| 저장소       | `owner/name`. SDK 메이저가 old·deprecated가 되면 여기에 GitHub 이슈가 열린다                                   |
| 게임 서버 키 | 아래                                                                                                           |

### 게임 서버 키 (`csk_…`)

게임 자체 서버가 검증된 점수를 낼 때 쓰는 게임별 키([game-servers.md](../game-servers.md)).

- **발급**: 라벨을 붙여 발급한다. 키 원문은 **이때 한 번만** 보인다. 팀에 안전한 경로로 전달한다.
- **교체(rotate)**: 새 키를 바로 주고, 이전 키는 24시간 뒤 만료된다. 그 사이 팀이 서버 설정을 바꾼다.
- **폐기**: 즉시 무효. 유출이 의심되면 폐기 후 새로 발급한다.

## SDK 메이저 수명주기

메이저는 `current → lts → old → deprecated` 순서로만 움직인다. 상태별 효과와 일정 원칙은
[sdk-lifecycle.md](../sdk-lifecycle.md)에 있다.

- 상태와 `old_at`·`deprecated_at` 날짜는 DB(`sdk_versions`) 데이터다. 관리 API는 조회만 한다(`GET /v1/admin/sdk`).
  바꿀 때는 의도적으로, 기록을 남기고 SQL로 한다. **deprecated는 되돌릴 수 없고, 그 메이저의 게임은 실행이
  멈춘다.**
- 날짜를 정해 두면 그 시각부터 적용되고, api가 `SDK_LIFECYCLE_INTERVAL_SECONDS`(기본 1시간)마다 저장값을 맞추며
  알린다(GitHub 이슈는 `GITHUB_NOTIFY_TOKEN`이 있을 때).
- 동시에 실행 가능한(current·lts·old) 메이저가 3개를 넘으면 경고가 뜬다.

## 호스트 어댑터 등록

포털은 게임이 핸드셰이크로 알리는 SDK 메이저에 맞는 어댑터를 실행 중에 불러온다. 어댑터 번들은 스토리지
(`adapters/v<N>/<버전>/index.js`)에 있고 API가 서빙, 포털이 같은 출처(`/adapters/…`)로 중계하며 SRI로 검사한다.
새 플랫폼 릴리스마다 어댑터를 등록하면 포털 배포 없이 바뀐다.

플랫폼 릴리스(GitHub Releases)에는 메이저별 어댑터 번들 `adapters-v<N>-<버전>.tar.gz`와 `.sha256`이 첨부된다.
api 이미지 안의 등록 도구로 올린다. 도구는 api와 **같은 env와 네트워크**가 필요하다(DB·스토리지에 접속):

```bash
V=0.12.0
curl -fLO https://github.com/team-croffle/croffle-play/releases/download/v$V/adapters-v1-$V.tar.gz
curl -fLO https://github.com/team-croffle/croffle-play/releases/download/v$V/adapters-v1-$V.tar.gz.sha256
sha256sum -c adapters-v1-$V.tar.gz.sha256
tar xzf adapters-v1-$V.tar.gz                      # → v1/$V/index.js, manifest.json

# api를 Docker Compose 서비스(api)로 운영할 때: 그 서비스의 env·네트워크를 그대로 쓴다
docker compose run --rm --no-deps -v "$PWD/v1:/adapters/v1:ro,z" \
  api node dist/sdk/register-cli.js /adapters/v1/$V
# SDK v1 → /adapters/v1/<버전>/index.js (sha384-…)
```

- Compose 없이 띄울 때는 `docker run --rm --env-file <api env 파일> --network <api가 붙은 네트워크> …`로 같은
  조건을 맞춘다. env가 compose 파일의 `environment:`에만 있으면 env 파일에는 빠져 있으니 주의(최소
  `DATABASE_URL`, `S3_*`).
- `:z`는 SELinux가 켜진 호스트(Fedora·RHEL 계열)에서 컨테이너가 마운트한 파일을 읽게 해 준다. 빠지면 파일
  권한이 맞아도 `EACCES`가 난다. SELinux가 없는 호스트에서는 무시된다.
- 도구는 시작할 때 DB 마이그레이션을 확인한다. `schema "drizzle" already exists, skipping` 같은 NOTICE는 정상.
- 도구는 `index.js`를 `manifest.json`의 SRI와 대조한 뒤 스토리지에 올리고, 그 메이저의 어댑터 주소를 바꾼다.
  메이저가 없으면 `current`로 만들고, 있는 메이저의 수명주기 상태는 건드리지 않는다.
- 저장소에서 직접 빌드할 수도 있다:
  `VERSION=$V pnpm --filter @croffledev/play-adapters build` →
  `pnpm --filter @croffledev/play-api sdk:register apps/adapters/dist/v1/$V`.
- 되돌리기: 이전 버전 번들로 같은 명령을 다시 실행한다. 번들 경로가 버전별이라 이전 파일은 그대로 남아 있다.

## 점검 목록

- 새 게임: 등록 → 주소 연결 → `play-cli check` → 다시 읽기 → 미리보기 → 공개
- 새 플랫폼 릴리스: 이미지 교체(api·rooms·shell) → 어댑터 등록 → 게임 하나 플레이해 보기
- 서버 키 유출 의심: 폐기 → 새로 발급 → 팀에 전달
- 새 SDK 메이저: 어댑터 등록 → 이전 메이저 일정(`lts`·`old_at`·`deprecated_at`) 결정 → 공지
