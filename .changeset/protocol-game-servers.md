---
'@croffledev/play-protocol': minor
'@croffledev/play-sdk': minor
'@croffledev/play-cli': patch
---

Tier 2 game servers: `game.json` `server.image` (from `ghcr.io/team-croffle/`, pinned tag or digest, never `latest`) is required when `needsServer` is true, and v1 `getServerInfo` (capability `server`, `sdk.getServerInfo()`) tells a game where its approved server is. `play-cli validate` enforces the new manifest rule.
