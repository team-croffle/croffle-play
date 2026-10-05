# Game server examples

Minimal authoritative servers for a game that declares `server: { url, protocol }` in its
`game.json`. Both do the same thing: accept a WebSocket from the game's own origin, require the
platform **game token** as the first message, verify it against the platform JWKS (`iss`,
`aud: game:<id>`, signature, expiry), and own the game state (a shared counter).

| Example        | Stack                                        |
| -------------- | -------------------------------------------- |
| [node](./node) | `ws` + `jose`                                |
| [go](./go)     | `coder/websocket` + `golang-jwt` + `keyfunc` |

The game gets its token with `sdk.getToken()` and the server address with `sdk.getServerInfo()`;
`GET /protocol` lets the client check compatibility before connecting. The team hosts the server
wherever it likes (see [docs/game-servers.md](../../game-servers.md)). Environment:

`GAME_ID`, `PORT`, `PROTOCOL_VERSION`, `PLATFORM_JWKS_URL`, `TOKEN_ISSUER`, `TOKEN_AUDIENCE`,
`ALLOWED_ORIGIN` (defaults to `https://<GAME_ID>.play.croffle-play.link`).
