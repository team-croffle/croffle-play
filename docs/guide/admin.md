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
2. **호스팅 방식** — 둘 중 하나.
   - **팀 호스팅**: 게임 팀의 호스트로 `<id>.play.croffle-play.link`를 연결한다(DNS·프록시, 저장소 밖 운영 일).
     팀이 배포하면 `play-cli check`로 확인한다:
     ```bash
     npx @croffledev/play-cli check https://<id>.play.croffle-play.link/ --portal https://game.croffle-play.link
     ```
   - **플랫폼 호스팅**: `<id>.play.croffle-play.link`가 게임 호스트(`games` 이미지)로 가게 둔다(와일드카드 DNS).
     `/admin/games/<id>`에서 zip을 올리거나, 팀에 **배포 키**를 발급해 `play-cli deploy`로 올리게 한다. 올리면
     호스팅 방식이 자동으로 플랫폼으로 바뀐다.
3. **game.json** — 팀 호스팅은 `/admin/games/<id>`에서 **다시 읽기**: 포털이 `<origin>/game.json`을 읽어 id
   일치와 SDK 메이저(current·lts만)를 확인한다. 실패하면 사유가 화면과 팀의 `/dev`에 남고, 이전에 읽은 값은
   그대로다. 플랫폼 호스팅은 업로드 때 zip의 `game.json`을 같은 규칙으로 검사해 저장하므로 다시 읽기가 없다.
4. **미리보기** — `/game/<id>/play?preview=1`. 비공개 게임은 관리자만 열 수 있다. 로딩·핸드셰이크·점수가
   되는지 본다.
5. **공개** — 카탈로그에 나온다. **비공개로** 돌리면 사라지지만 미리보기는 계속 된다.

게임 콘텐츠 업데이트에는 할 일이 없다. 팀 호스팅 게임이 SDK 메이저를 올렸거나 `game.json`의 `server`를 바꿨을
때만 다시 읽는다.

## 게임 설정 (`/admin/games/<id>`)

| 항목          | 내용                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| 기본 정보     | 이름                                                                                                           |
| 멤버          | 게임 팀원(포털 계정). 역할 `owner`·`developer`. 멤버는 `/dev`에서 게임 상태·SDK 경고·읽기 실패 사유를 본다     |
| 점수          | 정책 `client`(브라우저 점수, 미검증 표시) 또는 `server`(게임 서버가 서버 키로 낸 점수만), 허용 범위(최소·최대) |
| 저장소        | `owner/name`. SDK 메이저가 old·deprecated가 되면 여기에 GitHub 이슈가 열린다                                   |
| 업로드 호스팅 | 아래. zip 업로드, 업로드 기록, 되돌리기, 팀 호스팅으로 전환                                                    |
| 배포 키       | 아래. CI·`play-cli deploy`용 (`cdk_…`)                                                                         |
| 게임 서버 키  | 아래                                                                                                           |

### 업로드 호스팅

- **업로드**: zip 하나. 루트(또는 폴더 하나 안)에 `game.json`(id 일치, SDK 메이저 등록 가능, `entry` 존재).
  상한은 api env `UPLOAD_*`(기본 zip 100 MB, 해제 300 MB, 파일 2,000개, 파일 50 MB). 올리면 바로 서비스된다.
- **기록·되돌리기**: 최근 `DEPLOY_KEEP`(기본 5)개가 남는다. 이전 빌드의 "되돌리기"는 포인터만 바꾼다(그 빌드의
  SDK 메이저가 여전히 등록 가능해야 한다). 더 오래된 업로드는 스토리지에서 지워진다.
- **전환**: "팀 호스팅으로 전환"하면 플랫폼은 서빙을 멈추고 업로드는 남는다(다시 플랫폼으로 돌리면 가장 최근
  업로드가 서비스된다). 플랫폼 호스팅 게임은 `game.json` 다시 읽기가 409로 거부된다.
- **운영**: `<id>.play.<domain>` 와일드카드를 `games` 이미지로 보낸다. 팀 호스팅 게임은 개별 레코드로 팀 호스트로
  보낸다. 게임 호스트는 스토리지만 읽으므로 api·DB 장애와 무관하게 서빙된다(env: [앱 환경 변수](../reference/env.md)).

### 배포 키 (`cdk_…`)

게임 저장소의 CI나 `play-cli deploy`가 로그인 없이 빌드를 올릴 때 쓰는 게임별 키. 그 게임에만 올릴 수 있다.
관리자(`/admin/games/<id>`)와 게임 멤버(`/dev`)가 발급한다. 발급·교체·폐기 규칙은 서버 키와 같다(원문 1회,
교체 시 24시간 겹침). 팀에는 GitHub 저장소 secret `CROFFLE_DEPLOY_KEY`에 넣으라고 안내한다.

### 게임 서버 키 (`csk_…`)

게임 자체 서버가 검증된 점수를 낼 때 쓰는 게임별 키([game-servers.md](../game-servers.md)).

- **발급**: 라벨을 붙여 발급한다. 키 원문은 **이때 한 번만** 보인다. 팀에 안전한 경로로 전달한다.
- **교체(rotate)**: 새 키를 바로 주고, 이전 키는 24시간 뒤 만료된다. 그 사이 팀이 서버 설정을 바꾼다.
- **폐기**: 즉시 무효. 유출이 의심되면 폐기 후 새로 발급한다.

## SDK 메이저 수명주기 (`/admin/sdk`)

메이저는 `current → lts → old → deprecated` 순서로만 움직인다. 상태별 효과와 일정 원칙은
[sdk-lifecycle.md](../sdk-lifecycle.md)에 있다.

- `/admin/sdk`에 메이저별 상태·예정 날짜·활성 어댑터가 보이고, `/admin/sdk/<N>`에서 바꾼다. 상태는 앞으로만
  고를 수 있고, `old`·`deprecated` 시작 날짜(UTC)를 정해 두면 그 시각부터 적용된다(api가
  `SDK_LIFECYCLE_INTERVAL_SECONDS`마다 저장값을 맞추고, 저장 직후에도 한 번 맞춘다). 알림은 GitHub 이슈
  (`GITHUB_NOTIFY_TOKEN`이 있을 때)와 `/dev` 경고.
- **deprecated는 되돌릴 수 없고 그 메이저의 게임은 실행이 멈춘다.** 그래서 화면이 메이저 번호를 다시 입력받고,
  API도 `confirm: <메이저>` 없이는 거부한다.
- 바꾼 것은 모두 변경 기록(누가·언제·무엇)에 남는다. DB를 직접 고치지 않는다.
- 동시에 실행 가능한(current·lts·old) 메이저가 3개를 넘으면 경고가 뜬다.

## 호스트 어댑터

포털은 게임이 핸드셰이크로 알리는 SDK 메이저에 맞는 어댑터를 실행 중에 불러온다. 어댑터 번들은 스토리지
(`adapters/v<N>/<버전>/index.js`)에 있고 API가 서빙, 포털이 같은 출처(`/adapters/…`)로 중계하며 SRI로 검사한다.

### 릴리스마다: 이미지 교체면 끝

api 이미지에는 그 릴리스의 어댑터 번들이 들어 있고(`/app/adapters/v<N>/<버전>/`), api가 시작할 때 활성
어댑터가 아니면 스토리지에 올리고 활성화한다(`ADAPTER_AUTO_REGISTER`, 기본 켜짐). 그래서 새 플랫폼 릴리스는
**이미지 교체**로 끝난다. 어댑터를 되돌리는 정식 방법도 **이전 api 이미지로 되돌리기**다.

- `/admin/sdk/<N>`에 등록된 어댑터 버전 목록이 보이고 다른 버전으로 전환할 수 있다. 다만 이미지의 버전이
  우선이라 **다음 api 시작 때 이미지 버전으로 돌아간다**(화면에도 표시). 급한 임시 조치에만 쓴다.
- 자동 등록을 끄면(`ADAPTER_AUTO_REGISTER=false`) 관리자가 고른 버전이 유지된다. 그때는 아래 수동 등록으로
  올린다.
- 메이저가 처음 등록되면 `current`로 생기고, 있는 메이저의 수명주기 상태는 건드리지 않는다.
- deprecated 메이저의 어댑터 파일은 지우지 않는다(실행 차단은 상태가 한다).

### 수동 등록 (이미지와 별개로 올릴 때)

플랫폼 릴리스(GitHub Releases)에는 메이저별 어댑터 번들 `adapters-v<N>-<버전>.tar.gz`와 `.sha256`이 첨부된다.
api 이미지 안의 등록 도구로 올린다. 도구는 api와 **같은 env와 네트워크**가 필요하다(DB·스토리지에 접속):

```bash
V=0.13.0
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
- 도구는 `index.js`를 `manifest.json`의 SRI와 대조한 뒤 스토리지에 올리고, 그 메이저의 어댑터 주소를 바꾸며
  변경 기록(`cli`)을 남긴다. 자동 등록이 켜져 있으면 다음 api 시작 때 이미지 버전으로 돌아간다.
- 저장소에서 직접 빌드할 수도 있다:
  `VERSION=$V pnpm --filter @croffledev/play-adapters build` →
  `pnpm --filter @croffledev/play-api sdk:register apps/adapters/dist/v1/$V`.

## 점검 목록

- 새 게임(팀 호스팅): 등록 → 주소 연결 → `play-cli check` → 다시 읽기 → 미리보기 → 공개
- 새 게임(플랫폼 호스팅): 등록 → 배포 키 발급 또는 zip 업로드 → 미리보기 → 공개
- 새 플랫폼 릴리스: 이미지 교체(api·rooms·shell·games) → `/admin/sdk`에서 활성 어댑터가 새 버전인지 확인 → 게임 하나 플레이해 보기
- 서버 키 유출 의심: 폐기 → 새로 발급 → 팀에 전달
- 새 SDK 메이저: 새 api 이미지(어댑터 포함) → `/admin/sdk`에서 이전 메이저 일정(`lts`·old·deprecated 날짜) 결정 → 공지
