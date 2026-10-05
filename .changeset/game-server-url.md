---
'@croffledev/play-protocol': minor
'@croffledev/create-play-game': patch
---

`game.json` declares a game's own server as `server: { url, protocol }` (https/wss; http/ws only on localhost). `needsServer`, `server.image`, `serverImageSchema`, and `SERVER_IMAGE_PREFIX` are gone: teams host their servers, and the platform only issues game tokens. The template's `game.json` drops `needsServer`.
