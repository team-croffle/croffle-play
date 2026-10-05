# 전용 게임 서버 (Tier 2)

공용 룸 서버(중계)로 부족한 게임 — 서버가 판정해야 하는 경쟁 게임 등 — 은 자체 서버를 승인받아 플랫폼
서버에서 격리된 컨테이너로 돌릴 수 있다. **승인제**다. 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md) §6.

## 1. 게임 쪽 선언

`game.json`:

```json
{
  "needsServer": true,
  "server": {
    "protocol": "2.0.0",
    "image": "ghcr.io/team-croffle/arena-server:2.0.0"
  }
}
```

- 이미지는 `ghcr.io/team-croffle/`에서만, 태그나 `@sha256:` 다이제스트로 고정(`latest` 금지).
- `protocol`은 클라이언트와 서버가 주고받는 메시지 형식의 버전이다. 서버는 `GET /protocol`로 자기
  버전을 알려 클라이언트가 접속 전에 호환을 확인한다.

publish가 끝나면 서버가 **승인 요청** 상태가 된다. 같은 이미지·프로토콜로 다시 publish하면 상태가
유지되고, 바뀌면 다시 승인받아야 한다.

## 2. 서버 구현

[예제 (Node, Go)](./examples/game-server/README.md)를 시작점으로 쓴다. 지켜야 할 것:

- 연결 직후 **첫 메시지**로 받은 게임 토큰을 플랫폼 JWKS로 검증한다: 서명, `iss`(`TOKEN_ISSUER`),
  `aud = game:<id>`(`TOKEN_AUDIENCE`), 만료. 토큰을 URL로 받지 않는다.
- `Origin`이 게임 origin(`https://<id>.play.croffle-play.link`)인지 확인한다.
- 쿠키를 쓰지 않는다(엣지에서 `Set-Cookie`가 제거된다). 저장할 데이터는 플랫폼 공개 API로.
- 읽기 전용 파일시스템, uid 10001, 권한 없음, CPU 1·메모리 512MB·프로세스 256개로 돈다고 가정한다.
  쓰기는 `/tmp`(64MB)만.

게임 클라이언트:

```ts
const { url, protocol } = await sdk.getServerInfo(); // 승인된 서버가 없으면 'unsupported'
const { token } = await sdk.getToken(); // aud: game:<id>, 10분
const ws = new WebSocket(url.replace(/^http/, 'ws'));
ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token }));
```

## 3. 플랫폼 관리자

1. `/admin/games/<id>`의 **전용 서버** 섹션에서 이미지·프로토콜을 확인하고 승인한다.
2. **compose 내려받기**로 받은 서비스 정의를 운영 환경에 적용한다(배포는 이 저장소 밖의 일이다).
3. 승인 폐기는 실행 중인 컨테이너를 멈추지 않는다. 운영 환경에서 직접 멈춘다.

> v0.11에서 이 승인제는 `game.json`에 자체 서버 주소를 선언하는 방식으로 바뀐다.

생성된 서비스는 `games-net`에만 붙고(DB·스토리지·플랫폼 내부 네트워크 없음), 읽기 전용·비루트·
`cap_drop: ALL`·`no-new-privileges`·자원 제한이 걸리며, 리버스 프록시(Traefik)가
`<id>.srv.croffle-play.link`로 라우팅하면서 `Set-Cookie`를 지운다.
