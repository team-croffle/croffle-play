# SDK 수명주기 정책

게임은 빌드할 때의 `@croffledev/play-sdk` 메이저에 고정된다. 플랫폼은 메이저마다 호스트 어댑터를
유지하고, 오래된 메이저는 정해진 일정에 따라 은퇴시킨다. 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md).

처음부터 끝까지의 흐름은 [게임 개발자 가이드](./guide/developer.md)에 있다.

## 상태

`current → lts → old → deprecated` 순서로만 움직인다.

| 상태       | 플레이 | 새 등록·주소 변경 | 플레이어에게                               | 개발자에게                          |
| ---------- | ------ | ----------------- | ------------------------------------------ | ----------------------------------- |
| current    | O      | O                 | —                                          | —                                   |
| lts        | O      | O                 | —                                          | —                                   |
| old        | O      | **X**             | —                                          | 등록 거부, GitHub 이슈, `/dev` 경고 |
| deprecated | **X**  | X                 | 목록에 남되 "업데이트되지 않음", 실행 불가 | GitHub 이슈, `/dev` 경고            |

- 상태는 DB(`sdk_versions`)의 데이터다. `old_at`·`deprecated_at` 날짜를 정하면 그 시각부터 자동으로 적용되고
  (조회 시점 계산), 매시간 도는 작업이 저장값을 맞추며 전환을 기록하고 알린다. deprecated는 되돌아가지 않는다.
- 어떤 메이저로 만든 게임인지는 두 곳에서 본다. 등록할 때는 게임의 `game.json` `sdk` 범위, 실행할 때는 게임이
  보내는 핸드셰이크(`__hello`)의 SDK 버전. 실행 여부와 어댑터는 핸드셰이크 기준이다.
- 동시에 실행 가능한(current·lts·old) 메이저는 **3개까지**. 넘으면 관리자 API와 로그에 경고가 뜬다.
- 일정의 기준: 메이저는 1년에 한 번 정도, LTS는 약 18개월, old → deprecated 사이는 최소 3개월.

## 알림

- **등록**: old·deprecated 메이저를 쓰는 `game.json`으로는 게임을 새로 공개하거나 주소를 바꿀 수 없다. 거부
  메시지에 이 문서 링크가 들어간다.
- **GitHub 이슈**: 관리자가 게임에 저장소(`owner/name`)를 등록해 두면, 그 게임의 메이저가 old나 deprecated가 될
  때 이슈가 한 번씩 열린다(플랫폼의 `GITHUB_NOTIFY_TOKEN`).
- **개발자 대시보드** (`/dev`): 멤버로 등록된 게임의 SDK 상태와 할 일.
- **Renovate**: 게임 템플릿에 포함. 마이너·패치는 자동, 메이저는 라벨을 단 PR.

## 업그레이드

```bash
npx @croffledev/play-sdk migrate 1-to-2 src   # 메이저 사이 codemod (없으면 변경 불필요라고 알려 줌)
pnpm add @croffledev/play-sdk@^2
```

기능 확인은 항상 `sdk.has('<capability>')`로 하므로, 마이너 업데이트는 코드 변경 없이 받는다.

## 운영자 메모

- 상태·날짜 변경은 DB 데이터 변경이다. 의도적으로, 기록을 남기고 한다(예: 마이그레이션 SQL 또는 관리 도구).
- 새 메이저 출시 = `packages/sdk` 메이저 + `apps/adapters/v<N>` + 어댑터 등록. 포털 배포는 필요 없다.
