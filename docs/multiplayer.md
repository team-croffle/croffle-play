# 멀티플레이 가이드

공용 룸 서버(WebSocket)로 2~16명이 같은 방에서 메시지를 주고받는다. 서버는 **중계만** 한다. 게임 로직은
클라이언트가 돌리고, 방장(`room.isHost`)이 판정·상태 동기화를 맡는 구조를 권장한다. 설계 배경은
[ARCHITECTURE.md](./ARCHITECTURE.md) §6.

## 사용법

```ts
import { createSdk } from '@croffledev/play-sdk';

const sdk = await createSdk({ game: 'tetris' });
if (!sdk.has('rooms')) {
  // 로그인하지 않았거나 플랫폼 밖(mock)이다. 싱글 플레이로.
}

const room = await sdk.joinRoom('lobby', { maxPeers: 4 }); // 방 이름 생략 → 서버가 만들어 줌(room.id 공유)
room.on('peer-join', (peer) => console.log(peer.nickname));
room.on('message', (data, from) => apply(data, from));
room.on('host', () => (room.isHost ? startSimulation() : stopSimulation()));
room.on('reconnecting', () => showBanner('다시 연결 중…'));
room.on('reconnected', () => hideBanner());
room.on('closed', (reason) => backToMenu(reason));

room.send({ move: 'left' }); // 같은 방의 다른 모두에게
room.send({ hello: true }, peerId); // 한 명에게
room.leave();
```

- 플레이어는 로그인해야 한다. 게스트에게는 `rooms` 실패 시 로그인 안내가 셸에 뜬다.
- `room.self.id`는 **연결** id다. 재연결하면 바뀌므로 플레이어 식별은 `peer.userId`로 한다.
- 메시지는 JSON, 프레임당 16KB, 연결당 초당 30개(순간 60)까지. 넘으면 연결이 끊긴다.

## SDK가 대신 해 주는 것

- 연결 직후 **첫 메시지로** 게임 토큰(`aud: game:<id>`, 10분)을 보낸다. 토큰은 URL에 넣지 않는다.
- 30초마다 ping(Cloudflare는 약 100초 무통신 연결을 끊는다).
- 끊기면 0.5초부터 2배씩 최대 30초 간격(지터 포함)으로 재연결하고, 새 토큰으로 같은 방에 다시 들어간다.
  인증 실패·Origin 거부·프로토콜 오류, `leave()`, 토큰을 더 받을 수 없을 때는 재연결하지 않고 `closed`.

## 서버가 확인하는 것

- 토큰 서명(플랫폼 JWKS)·발급자·만료, `aud`에서 게임 id를 얻는다(클라이언트가 게임을 주장할 수 없다).
- 브라우저가 붙인 `Origin`이 그 게임의 origin(`https://<id>.play.croffle-play.link`)과 같아야 한다.
- 방은 게임별로 분리된다. 같은 이름의 방이라도 다른 게임과 섞이지 않는다.
- 상태는 메모리에만 있다. 룸 서버가 재시작되면 방이 사라지고, 클라이언트가 재입장하며 다시 만든다.

## 로컬 개발

플랫폼 없이(mock 호스트) 멀티플레이는 안 된다. 로컬 스택을 띄운다:

```bash
pnpm dev:oidc & pnpm dev:games & pnpm dev:api & pnpm dev:rooms & pnpm dev:shell
# 브라우저 두 개(또는 시크릿 창)로 각각 로그인 → http://localhost:3000/game/duo/play
```

자체 서버가 필요한 게임(권위 서버)은 Tier 2 승인 대상이다.
