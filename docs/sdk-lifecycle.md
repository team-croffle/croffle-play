# SDK 수명주기 정책

게임은 빌드할 때의 `@croffledev/play-sdk` 메이저에 고정된다. 플랫폼은 메이저마다 호스트 어댑터를
유지하고, 오래된 메이저는 정해진 일정에 따라 은퇴시킨다. 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md) §3.

## 상태

| 상태        | 플레이 | 새 버전 publish | 플레이어에게           | 개발자에게                        |
| ----------- | ------ | --------------- | ---------------------- | --------------------------------- |
| current     | O      | O               | —                      | —                                 |
| lts         | O      | O               | —                      | —                                 |
| maintenance | O      | O (경고)        | —                      | publish 경고, `/dev` 경고         |
| deprecated  | O      | **X**           | "곧 지원 종료"         | publish 거부, GitHub 이슈, `/dev` |
| eol         | **X**  | X               | "지원 종료", 실행 불가 | GitHub 이슈                       |

- 상태는 DB(`sdk_versions`)의 데이터다. `deprecated_at`·`eol_at` 날짜를 정하면 그 시각부터 자동으로 적용되고
  (조회 시점 계산), 매시간 도는 작업이 저장값을 맞추며 전환을 기록·알린다.
- 동시에 살아 있는(current·lts·maintenance) 메이저는 **3개까지**. 넘으면 관리자 API와 로그에 경고가 뜬다.
- 일정의 기준: 메이저는 1년에 한 번 정도, LTS는 약 18개월, deprecated → eol 사이는 최소 3개월.

## 알림

- **publish**: deprecated·eol 메이저로 만든 버전은 거부되고, 메시지에 종료일과 이 문서 링크가 들어간다.
  maintenance는 통과하되 경고가 `play-cli` 출력에 나온다.
- **GitHub 이슈**: 관리자가 게임에 저장소(`owner/name`)를 등록해 두면, 그 게임의 stable·preview 버전이 쓰는
  메이저가 deprecated나 eol이 될 때 이슈가 한 번씩 열린다(플랫폼의 `GITHUB_NOTIFY_TOKEN`).
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
- 새 메이저 출시 = `packages/sdk` 메이저 + `apps/adapters/v<N>` + `sdk:register`로 어댑터 등록. 셸 배포는 필요 없다.
