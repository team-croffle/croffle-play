# SDK 레퍼런스 (`@croffledev/play-sdk` v1)

게임이 플랫폼과 이야기하는 SDK의 공개 API 전부. 처음이라면 [게임 개발자 가이드](../guide/developer.md)부터 읽는다.
SDK는 게임 번들에 들어가고, 플랫폼(포털)과는 `postMessage`로만 통신한다. 게임은 플랫폼 세션을 갖지 않는다.

```bash
npm install @croffledev/play-sdk
```

```ts
import { createSdk } from '@croffledev/play-sdk';
import { createMockHost } from '@croffledev/play-sdk/mock';

const sdk = await createSdk({
  game: 'tetris',
  // 플랫폼 밖(vite dev)에서는 mock 호스트
  transport: window.parent === window ? createMockHost() : undefined,
});

await sdk.ready();
const user = await sdk.getUser(); // 게스트면 null
if (sdk.has('score')) await sdk.submitScore(1200);
sdk.on('pause', () => game.pause());
```

## 기본 규칙

- **기능 확인은 `sdk.has(capability)`로** 한다. SDK나 플랫폼 버전을 비교하지 않는다. 지원하지 않는 기능을
  부르면 `SdkError('unsupported')`로 거부된다.
- 모든 메서드는 `Promise`를 돌려주고, 실패는 [`SdkError`](#sdkerror)로 거부된다.
- 게임은 만든 SDK 메이저에 고정된다. 메이저 안에서 추가되는 기능은 capability로 알린다. 메이저 수명주기는
  [sdk-lifecycle.md](../sdk-lifecycle.md).

## `createSdk(options)`

플랫폼(또는 mock 호스트)과 핸드셰이크(`__hello` → `__welcome`)를 하고 연결된 [`SdkClient`](#sdkclient)를 돌려준다.

| 옵션                 | 타입        | 기본값      | 설명                                                                   |
| -------------------- | ----------- | ----------- | ---------------------------------------------------------------------- |
| `game`               | `string`    | (필수)      | `game.json`의 `id`                                                     |
| `transport`          | `Transport` | 부모 window | 호스트 연결. 로컬 실행은 `createMockHost()`                            |
| `timeoutMs`          | `number`    | `10000`     | 요청 하나의 제한 시간                                                  |
| `handshakeTimeoutMs` | `number`    | `10000`     | 플랫폼이 `__hello`에 답하기를 기다리는 시간. 넘으면 `timeout`으로 거부 |

- iframe 밖에서 `transport` 없이 부르면 `unsupported`로 바로 거부된다.
- 핸드셰이크는 호스트가 답할 때까지 250ms마다 `__hello`를 다시 보낸다.

## `SdkClient`

### `has(capability): boolean`

호스트가 기능을 지원하면 `true`. `sdk.capabilities`(`ReadonlySet<string>`)로 전체 목록도 볼 수 있다.

### `ready(): Promise<void>`

게임 로딩이 끝났다고 알린다. 포털이 로딩 화면을 걷는다. 부르지 않으면 15초 뒤에 걷힌다. capability 없음.

### `getUser(): Promise<PublicUser | null>` — `user`

로그인한 플레이어의 공개 프로필. 게스트면 `null`.

```ts
interface PublicUser {
  id: string; // 플랫폼 계정 id (게임별로 같음)
  nickname: string;
  avatar: string | null; // 이미지 URL
}
```

IdP subject, 이메일, 토큰은 게임에 오지 않는다.

### `submitScore(score: number): Promise<{ accepted: boolean }>` — `score`

점수 제출. `score`는 유한한 숫자. 관리자가 게임에 점수 범위를 정했으면 범위 밖은 `invalid_request`. 게스트는
`auth_required`(포털이 로그인 창을 띄운다). 게임의 점수 정책이
"서버 점수만"이면 브라우저 점수는 `accepted: false`로 기록되지 않는다 — 게임 서버가 서버 키로 낸 점수만 순위에
들어간다([game-servers.md](../game-servers.md)).

### `save(slot: string, data: string): Promise<void>` — `save`

플레이어 저장. `slot`은 `^[a-z0-9_-]{1,32}$`, `data`는 문자열 최대 256K자(`MAX_SAVE_LENGTH`). 객체는
`JSON.stringify`해서 넣는다. 게스트는 `auth_required`.

### `load(slot: string): Promise<string | null>` — `save`

저장 읽기. 없으면 `null`.

### `getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>` — `leaderboard`

이 게임의 순위(플레이어별 최고 점수). `limit` 1–100, 기본 10.

```ts
interface LeaderboardEntry {
  rank: number;
  user: PublicUser;
  score: number;
}
```

### `setFullscreen(on: boolean): Promise<boolean>` — `fullscreen`

포털이 게임 영역을 전체 화면으로 바꾼다. 실제로 적용된 상태를 돌려준다(브라우저가 거부하면 `false`).

### `exit(): Promise<void>` — `exit`

게임 종료. 포털이 게임 상세 페이지로 돌아간다.

### `getToken(): Promise<{ token: string; expiresAt: string }>` — `token`

이 게임 전용 단기 토큰(JWT, `aud: game:<id>`, 기본 10분). 게임 자체 서버나 룸 서버에 플레이어를 증명할 때 쓴다.
서버는 플랫폼 JWKS로 검증한다. **URL에 넣지 말고** 연결 뒤 첫 메시지로 보낸다. 게스트는 `auth_required`.

### `getServerInfo(): Promise<{ url: string; protocol: string }>` — `server`

`game.json`의 `server`에 선언한 게임 자체 서버 주소와 프로토콜. 선언이 없으면 `unsupported`로 거부된다.
연결 방법은 [game-servers.md](../game-servers.md).

### `joinRoom(room?, opts?): Promise<Room>` — `rooms` + `token`

공용 룸 서버의 방에 들어간다. `room`을 빼면 새 방을 만들고, `room.id`를 친구에게 공유한다.

| 인자            | 타입            | 설명                                           |
| --------------- | --------------- | ---------------------------------------------- |
| `room`          | `string`        | 방 id `^[a-z0-9][a-z0-9-]{0,31}$`. 없으면 생성 |
| `opts.maxPeers` | `number`        | 방을 만들 때 정원 2–16, 기본 8                 |
| `opts.socket`   | `SocketFactory` | WebSocket 대체(테스트용)                       |

SDK가 30초 ping, 끊기면 지수 백오프 재접속, 같은 방 재입장(새 토큰)을 알아서 한다. 자세한 흐름은
[multiplayer.md](../multiplayer.md).

### `on(type, listener): () => void`

호스트 이벤트 구독. 해제 함수를 돌려준다.

| 이벤트   | 언제                             |
| -------- | -------------------------------- |
| `pause`  | 포털 탭이 가려짐 — 게임을 멈춘다 |
| `resume` | 다시 보임                        |

### `dispose(): void`

메시지 수신을 멈추고 진행 중인 요청을 `internal`로 거부한다.

### `request(type, payload)`

저수준 요청. 위의 메서드를 쓰는 것을 권장한다.

## `Room`

| 멤버              | 설명                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| `id`              | 방 id                                                                        |
| `self`            | 나(`Peer`). 재접속하면 `self.id`가 바뀐다                                    |
| `peers`           | `Map<string, Peer>` — 방의 다른 참가자                                       |
| `host` / `isHost` | 방장 연결 id / 내가 방장인지. 게임 로직의 기준 클라이언트로 쓴다             |
| `send(data, to?)` | 모두(나 빼고) 또는 한 명에게. JSON 16KB까지, 초당 30개. 재접속 중엔 버려진다 |
| `on(event, fn)`   | 아래 이벤트 구독. 해제 함수를 돌려준다                                       |
| `leave()`         | 방을 나간다(`closed('left')`)                                                |

```ts
interface Peer {
  id: string; // 연결 id (한 플레이어가 탭 여러 개면 여러 개)
  userId: string; // 공개 계정 id
  nickname: string;
}
```

| 이벤트         | 인자           | 언제                                 |
| -------------- | -------------- | ------------------------------------ |
| `message`      | `(data, from)` | 다른 참가자가 보낸 메시지            |
| `peer-join`    | `(peer)`       | 참가자 입장                          |
| `peer-leave`   | `(peerId)`     | 참가자 퇴장                          |
| `host`         | `(peerId)`     | 방장이 바뀜                          |
| `reconnecting` | `(attempt)`    | 연결이 끊겨 다시 붙는 중(1부터)      |
| `reconnected`  | `()`           | 같은 방으로 돌아옴                   |
| `closed`       | `(reason)`     | 완전히 끝남(나감, 거부, 재입장 실패) |

## capability

`__welcome`이 알리는 기능 이름. 이름은 다른 뜻으로 다시 쓰지 않는다.

| 이름          | 메서드                         | mock 기본 |
| ------------- | ------------------------------ | --------- |
| `user`        | `getUser`                      | O         |
| `score`       | `submitScore`                  | O         |
| `save`        | `save`, `load`                 | O         |
| `fullscreen`  | `setFullscreen`                | O         |
| `exit`        | `exit`                         | O         |
| `leaderboard` | `getLeaderboard`               | O         |
| `token`       | `getToken` (`joinRoom`도 필요) | X         |
| `rooms`       | `joinRoom`                     | X         |
| `server`      | `getServerInfo`                | X         |

`ready`는 capability 없이 모든 호스트가 답한다.

## `SdkError`

```ts
class SdkError extends Error {
  readonly name: 'SdkError';
  readonly code: string; // 아래 코드. 모르는 코드는 internal로 다룬다
}
```

| 코드              | 뜻                                                       |
| ----------------- | -------------------------------------------------------- |
| `unsupported`     | 호스트가 지원하지 않거나 이 게임에 없는 기능             |
| `invalid_request` | 인자가 스키마에 맞지 않음(슬롯 이름, 저장 크기, 점수 등) |
| `auth_required`   | 로그인이 필요함. 포털이 로그인 창을 띄운다               |
| `rate_limited`    | 요청이 너무 많음. 잠시 뒤 다시                           |
| `timeout`         | 제한 시간 안에 답이 없음                                 |
| `internal`        | 플랫폼 오류, 또는 `dispose()`로 취소됨                   |

마이너 릴리스에서 코드가 늘 수 있다.

## mock 호스트 (`@croffledev/play-sdk/mock`)

플랫폼 없이 게임을 단독 실행(`vite dev`)할 때 쓰는 가짜 호스트. 진짜 호스트와 같은 스키마로 요청을 검사한다.

```ts
import { createMockHost, memoryStorage } from '@croffledev/play-sdk/mock';

const host = createMockHost({ user: null, storage: memoryStorage(), log: false });
const sdk = await createSdk({ game: 'tetris', transport: host });
host.emit('pause'); // 이벤트 흉내
host.scores; // 지금까지 제출된 점수
```

| 옵션           | 기본값                                                  | 설명                      |
| -------------- | ------------------------------------------------------- | ------------------------- |
| `user`         | `{ id: 'mock-user', nickname: 'Player', avatar: null }` | `null`이면 게스트         |
| `capabilities` | `token`·`rooms`·`server`를 뺀 전부                      | 알릴 기능                 |
| `storage`      | localStorage(안 되면 메모리)                            | 저장 위치(`get`, `set`)   |
| `log`          | `true`                                                  | 모든 메시지를 콘솔에 출력 |

`token`·`rooms`·`server`는 진짜 플랫폼이 필요하다. 로컬에서는 플랫폼 개발 스택(`pnpm dev:api`, `pnpm dev:shell`,
`pnpm dev:rooms`)에 게임을 올려 확인한다.

## 그 밖의 export

| 이름                           | 설명                                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| `SDK_VERSION`                  | 이 빌드가 `__hello`로 알리는 SDK 버전                                 |
| `Transport`, `windowTransport` | 호스트 연결 인터페이스와 기본 구현(부모 window, 부모의 메시지만 받음) |
| `SocketLike`, `SocketFactory`  | `joinRoom`의 WebSocket 대체용 타입                                    |
| `RoomEvents`                   | `Room` 이벤트 시그니처                                                |

## CLI: `play-sdk migrate`

메이저를 올릴 때 게임 코드를 바꿔 주는 codemod.

```bash
npx @croffledev/play-sdk migrate 1-to-2 src
```

지금은 v1뿐이라 등록된 codemod가 없다. 게임 검사·배포 확인은 별도 패키지 `@croffledev/play-cli`
(`validate`, `check`)가 한다.
