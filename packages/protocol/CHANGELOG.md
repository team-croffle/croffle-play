# @croffledev/play-protocol

## 0.3.0

### Minor Changes

- c2424e5: Add `UPLOAD_LIMITS`: the default size and file-count limits of a game build uploaded for platform hosting.

## 0.2.1

### Patch Changes

- 3281ea6: Document the public API: TSDoc on every `SdkClient` method and `Room` member, a README that lists
  methods, capabilities, and error codes, and a link to the SDK reference. `getServerInfo` now
  describes servers declared in `game.json` (no approval step).

## 0.2.0

### Minor Changes

- bcdb033: `game.json` declares a game's own server as `server: { url, protocol }` (https/wss; http/ws only on localhost). `needsServer`, `server.image`, `serverImageSchema`, and `SERVER_IMAGE_PREFIX` are gone: teams host their servers, and the platform only issues game tokens. The template's `game.json` drops `needsServer`.
- 67a1154: `game.json` is now what a self-hosted game serves at `<game origin>/game.json` for the portal to read: `version` and `thumbnail` are optional. Adds `gameOrigin`, `gameUrl`, and `manifestUrl`, which build a game's addresses from one `{id}` template. `srv` and `preview` are no longer reserved game ids.
- 690673e: Adds `imageInfo` (format and size from a PNG, JPEG, or WebP header), moved from play-cli so the platform can share it.

## 0.1.0

### Minor Changes

- a5a8170: Tier 2 game servers: `game.json` `server.image` (from `ghcr.io/team-croffle/`, pinned tag or digest, never `latest`) is required when `needsServer` is true, and v1 `getServerInfo` (capability `server`, `sdk.getServerInfo()`) tells a game where its approved server is. `play-cli validate` enforces the new manifest rule.
- 2abcd7e: Initial protocol: frozen `__hello`/`__welcome` handshake, SDK v1 envelopes and messages (`ready`, `getUser`, `submitScore`, `save`, `load`, `exit`, `fullscreen`; `pause`/`resume` events), capability names, and the host core contract types.
- ab609bc: Add the v1 `getLeaderboard` request (`{ limit? }` → `{ entries: [{ rank, user, score }] }`) behind the new `leaderboard` capability.
- 07a1d45: Add the `game.json` manifest schema (`gameManifestSchema`, `parseManifest`), game id rules with the reserved subdomain list (`RESERVED_GAME_IDS`, `isValidGameId`), `semverSchema`, `relativePathSchema`, and `sdkRangeMajor()`.
- f8b20df: Add v1 `getToken` (capability `token`) and `getRoomsUrl` (capability `rooms`) requests, and the rooms wire format (`clientMessageSchema`, `serverMessageSchema`, `parseRoomsMessage`, `ROOMS` limits, `ROOMS_CLOSE` codes).
- 97f91d5: Thumbnail rules: `THUMBNAIL` limits in the protocol (PNG/JPEG/WebP, at most 512 KB, at least 256×144). `play-cli validate` reads the image header to check format and size.
