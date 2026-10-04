# Croffle Play — 로드맵

공개 로드맵. 단계만 적고 일정은 적지 않는다. 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md).

## Phase 1 — 계약

- 게임 ↔ 플랫폼 프로토콜(`@croffledev/play-protocol`)과 SDK v1(`@croffledev/play-sdk`)
- 플랫폼 없이 게임을 단독 실행하는 mock 호스트
- 게임 템플릿 저장소 (`game.json`, 빌드 규칙, 배포 워크플로)

## Phase 2 — 플랫폼 최소 기능

- 셸: 카탈로그, 게임 상세(SSR), 실행 페이지(iframe + 핸드셰이크)
- API: 게임·버전 레지스트리, 호스트 어댑터 v1
- 게임 도메인 서빙 (`<id>.croffle-play.link/<version>/`)

## Phase 3 — 계정과 배포

- 공통 로그인 (OIDC), 프로필, 점수·저장 (SDK 프록시)
- `play-cli` validate / publish, 게임별 배포 키, preview → 승인 → stable
- 관리자 미리보기·승인·롤백

## Phase 4 — 멀티플레이

- 공용 룸 서버 (WebSocket), SDK `rooms` API
- 자체 서버 게임(Tier 2): 게임 범위 토큰, JWKS, 격리된 컨테이너

## Phase 5 — 운영

- SDK 수명주기 자동화 (deprecated/eol, 알림, codemod)
- 모니터링, 백업, 요청 제한, 번들 크기 정책
- 공개 런칭
