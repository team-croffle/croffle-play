# Croffle Play — 로드맵

공개 로드맵. 단계만 적고 일정은 적지 않는다. 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md).

## Phase 1 — 계약

- 게임 ↔ 플랫폼 프로토콜(`@croffledev/play-protocol`)과 SDK v1(`@croffledev/play-sdk`)
- 플랫폼 없이 게임을 단독 실행하는 mock 호스트
- 게임 템플릿 (`npm create @croffledev/play-game`: `game.json`, 빌드 규칙)

## Phase 2 — 포털

- 포털(`game.croffle-play.link`): 게임 목록, 게임 상세, 공통 UI 안에서 게임 실행(iframe + 핸드셰이크)
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

## Phase 6 — 문서

- 게임 개발자 가이드, 관리자 가이드
- SDK 레퍼런스, 앱 환경 변수 레퍼런스
- 문서 사이트(GitHub Pages), 릴리스에 호스트 어댑터 번들 첨부

## Phase 7 — 플랫폼 호스팅

- 게임을 zip으로 올리면 플랫폼이 `<game>.play.croffle-play.link`에서 서빙 (팀 호스팅과 공존)
- 배포 기록과 롤백
- 호스트 어댑터 자동 등록, 관리자 화면에서 SDK 수명주기·어댑터 버전 관리
- 앱(api·rooms·shell·games)과 패키지의 독립 버전·릴리스

## Phase 8 — 공개 런칭

- 계정 삭제, 약관·개인정보 안내
- 검색·공유 메타데이터, 보안 신고 창구
- 브라우저 종단 간 시험
