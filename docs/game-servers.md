# 게임 자체 서버

공용 룸 서버(중계)로 부족한 게임 — 서버가 판정해야 하는 경쟁 게임, 방이 끝나도 남는 상태가 필요한 게임 —
은 자체 서버를 둔다. 서버도 게임처럼 팀이 직접 호스팅하고, 플랫폼은 "이 플레이어가 누구인지"만 토큰으로
알려 준다. 설계 배경은 [ARCHITECTURE.md](./ARCHITECTURE.md) §6. 공용 룸으로 충분한지는
[multiplayer.md](./multiplayer.md)에서 먼저 확인한다.

## 1. 선언

`game.json`:

```json
{
  "server": {
    "url": "wss://arena.example.com/ws",
    "protocol": "2.0.0"
  }
}
```

- `url`은 https:// 또는 wss://(로컬 개발만 http/ws://localhost). 관리자가 game.json을 다시 읽으면 반영된다.
- `protocol`은 클라이언트와 서버가 주고받는 메시지 형식의 버전이다. 서버는 `GET /protocol`로 자기 버전을
  알려 클라이언트가 접속 전에 호환을 확인한다.
- 승인 절차는 없다. 플랫폼은 서버를 실행하지도 연결하지도 않는다.

## 2. 서버 구현

[예제 (Node, Go)](./examples/game-server/README.md)를 시작점으로 쓴다. 지켜야 할 것:

- 연결 직후 **첫 메시지**로 받은 게임 토큰을 플랫폼 JWKS(`<API>/.well-known/jwks.json`)로 검증한다: 서명,
  `iss`(플랫폼 API origin), `aud = game:<id>`, 만료. 토큰을 URL로 받지 않는다.
- `Origin`이 게임 origin(`https://<id>.play.croffle-play.link`)인지 확인한다.
- 플레이어는 토큰의 `sub`(공개 계정 id)로 구분한다. 서버의 데이터베이스는 팀 것이고, 플랫폼 DB에는 접근할 수
  없다(플랫폼 데이터는 공개 API로만).
- 검증된 점수는 관리자에게 받은 **게임 서버 키**(`csk_…`)로 `POST /v1/games/<id>/scores/verified`에 낸다.
  게임의 점수 정책을 `server`로 두면 이 점수만 순위에 오른다.

게임 클라이언트:

```ts
const { url, protocol } = await sdk.getServerInfo(); // game.json에 server가 없으면 오류
const { token } = await sdk.getToken(); // aud: game:<id>, 10분
const ws = new WebSocket(url.replace(/^http/, 'ws'));
ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token }));
```
