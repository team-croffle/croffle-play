# Croffle Play — 로드맵

공개 로드맵. 단계만 적고 일정은 적지 않는다. 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md).

## Phase 1 — 계약

- 게임 ↔ 플랫폼 프로토콜(`@croffledev/play-protocol`)과 SDK v1(`@croffledev/play-sdk`)
- 플랫폼 없이 게임을 단독 실행하는 mock 호스트
- 게임 템플릿 (`npm create @croffledev/play-game`: `game.json`, 빌드 규칙)

## Phase 2 — 포털

- 포털(`www.croffle-play.link`): 게임 목록, 게임 상세, 공통 UI 안에서 게임 실행(iframe + 핸드셰이크)
- 게임 등록: 팀원이 각자 호스팅하는 게임(`<game>.play.croffle-play.link`)을 주소로 등록
- API: 게임 레지스트리, 호스트 어댑터 v1

## Phase 3 — 계정

- 계정 하나로 모든 게임: 공통 로그인(OIDC), 프로필, 점수·저장 (SDK 프록시)
- 플레이어 대시보드, 프로필 사진
- 관리자·개발자 대시보드: 게임 등록과 공개 관리

## Phase 4 — 멀티플레이

- 공용 룸 서버 (WebSocket), SDK `rooms` API
- 게임 자체 서버: 게임 범위 토큰, JWKS로 플레이어 확인

## Phase 5 — 안정화

- SDK 수명주기 자동화 (current → lts → old → deprecated, 알림, codemod)
- 요청 제한, 점수 신뢰 정책
- 공개 런칭
