# @croffledev/play-protocol

## 0.1.0

### Minor Changes

- a5a8170: Tier 2 game servers: `game.json` `server.image` (from `ghcr.io/team-croffle/`, pinned tag or digest, never `latest`) is required when `needsServer` is true, and v1 `getServerInfo` (capability `server`, `sdk.getServerInfo()`) tells a game where its approved server is. `play-cli validate` enforces the new manifest rule.
- 2abcd7e: Initial protocol: frozen `__hello`/`__welcome` handshake, SDK v1 envelopes and messages (`ready`, `getUser`, `submitScore`, `save`, `load`, `exit`, `fullscreen`; `pause`/`resume` events), capability names, and the host core contract types.
- ab609bc: Add the v1 `getLeaderboard` request (`{ limit? }` → `{ entries: [{ rank, user, score }] }`) behind the new `leaderboard` capability.
- 07a1d45: Add the `game.json` manifest schema (`gameManifestSchema`, `parseManifest`), game id rules with the reserved subdomain list (`RESERVED_GAME_IDS`, `isValidGameId`), `semverSchema`, `relativePathSchema`, and `sdkRangeMajor()`.
- f8b20df: Add v1 `getToken` (capability `token`) and `getRoomsUrl` (capability `rooms`) requests, and the rooms wire format (`clientMessageSchema`, `serverMessageSchema`, `parseRoomsMessage`, `ROOMS` limits, `ROOMS_CLOSE` codes).
- 97f91d5: Thumbnail rules: `THUMBNAIL` limits in the protocol (PNG/JPEG/WebP, at most 512 KB, at least 256×144). `play-cli validate` reads the image header to check format and size.
