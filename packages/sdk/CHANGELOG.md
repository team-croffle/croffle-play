# @croffledev/play-sdk

## 1.0.2

### Patch Changes

- 3281ea6: Document the public API: TSDoc on every `SdkClient` method and `Room` member, a README that lists
  methods, capabilities, and error codes, and a link to the SDK reference. `getServerInfo` now
  describes servers declared in `game.json` (no approval step).
- Updated dependencies [3281ea6]
  - @croffledev/play-protocol@0.2.1

## 1.0.1

### Patch Changes

- Updated dependencies [bcdb033]
- Updated dependencies [67a1154]
- Updated dependencies [690673e]
  - @croffledev/play-protocol@0.2.0

## 1.0.0

### Major Changes

- d3f5b27: SDK v1 (`1.0.0`): the package major is the SDK major the platform registers and serves an adapter for. Initial SDK v1 client: `createSdk({ game })` performs the `__hello`/`__welcome` handshake with the parent window, pins the host origin, and exposes `has()`, `ready()`, `getUser()`, `submitScore()`, `save()`, `load()`, `exit()`, `setFullscreen()`, and `pause`/`resume` events. Requests are validated locally and time out after 10 s.

  Adds `@croffledev/play-sdk/mock`: `createMockHost()` runs a game without the platform (fake user, localStorage saves, guest mode, `emit('pause' | 'resume')`), validating payloads like the real host.

### Minor Changes

- a5a8170: Tier 2 game servers: `game.json` `server.image` (from `ghcr.io/team-croffle/`, pinned tag or digest, never `latest`) is required when `needsServer` is true, and v1 `getServerInfo` (capability `server`, `sdk.getServerInfo()`) tells a game where its approved server is. `play-cli validate` enforces the new manifest rule.
- ab609bc: Add `sdk.getLeaderboard(limit?)` (capability `leaderboard`); the mock host answers it with the mock player's best score.
- 265f493: Add the `play-sdk` command: `npx @croffledev/play-sdk migrate <from>-to-<to> [dir]` runs the codemods between SDK majors over a game's sources (skipping `node_modules`, build output). No codemods exist yet, so it reports that no changes are needed.
- 84c77f2: Add multiplayer: `sdk.joinRoom(room?, { maxPeers })` returns a `Room` (`send`, `on('message' | 'peer-join' | 'peer-leave' | 'host' | 'reconnecting' | 'reconnected' | 'closed')`, `peers`, `host`, `isHost`, `leave`). The SDK authenticates with a fresh game token as the first message, pings every 30 s, and reconnects with exponential backoff, re-joining the same room. Also `sdk.getToken()` for games with their own server. The mock host does not provide rooms.

### Patch Changes

- Updated dependencies [a5a8170]
- Updated dependencies [2abcd7e]
- Updated dependencies [ab609bc]
- Updated dependencies [07a1d45]
- Updated dependencies [f8b20df]
- Updated dependencies [97f91d5]
  - @croffledev/play-protocol@0.1.0
