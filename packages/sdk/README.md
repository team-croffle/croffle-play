# @croffledev/play-sdk

SDK for games on [Croffle Play](https://github.com/team-croffle/croffle-play). Bundle it into your
game; the platform talks to it over `postMessage`. A game never holds a platform session: it sees a
public profile, and the portal proxies scores and saves.

```bash
npm install @croffledev/play-sdk
```

```ts
import { createSdk } from '@croffledev/play-sdk';
import { createMockHost } from '@croffledev/play-sdk/mock';

const sdk = await createSdk({
  game: 'tetris',
  // Outside the platform (vite dev), use the mock host.
  transport: window.parent === window ? createMockHost() : undefined,
});

await sdk.ready();
const user = await sdk.getUser(); // null for guests
if (sdk.has('score')) await sdk.submitScore(1200);
sdk.on('pause', () => game.pause());
```

- **Features**: check with `sdk.has(name)`, never by comparing versions. Capabilities: `user`,
  `score`, `save`, `fullscreen`, `exit`, `leaderboard`, `token`, `rooms`, `server`.
- **Methods**: `ready`, `getUser`, `submitScore`, `save`, `load`, `getLeaderboard`,
  `setFullscreen`, `exit`, `getToken`, `getServerInfo`, `joinRoom` (shared rooms server, with
  reconnect), `on('pause' | 'resume')`, `dispose`.
- **Errors**: `SdkError` with a stable `code` (`unsupported`, `invalid_request`, `auth_required`,
  `rate_limited`, `timeout`, `internal`).
- **Mock host** (`@croffledev/play-sdk/mock`): runs a game alone, validating requests with the real
  schemas.
- **Majors**: a game is pinned to the SDK major it was built with. `npx @croffledev/play-sdk migrate
<from>-to-<to>` runs the codemods between majors.

Documentation (Korean):
[SDK reference](https://github.com/team-croffle/croffle-play/blob/master/docs/reference/sdk.md) ·
[Game developer guide](https://github.com/team-croffle/croffle-play/blob/master/docs/guide/developer.md)
