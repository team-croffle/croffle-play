# Game server examples (Tier 2)

Minimal authoritative servers that a game with `needsServer: true` could run on Croffle Play. Both
do the same thing: accept a WebSocket from the game's own origin, require the platform **game
token** as the first message, verify it against the platform JWKS (`iss`, `aud: game:<id>`,
signature, expiry), and own the game state (a shared counter).

| Example        | Stack                                        |
| -------------- | -------------------------------------------- |
| [node](./node) | `ws` + `jose`                                |
| [go](./go)     | `coder/websocket` + `golang-jwt` + `keyfunc` |

The game gets its token with `sdk.getToken()` and the server address with `sdk.getServerInfo()`;
`GET /protocol` lets the client check compatibility before connecting. The platform runs approved
servers read-only as uid 10001 with no capabilities on an isolated network (see
[docs/game-servers.md](../../game-servers.md)); the environment variables below come from the
generated compose fragment:

`GAME_ID`, `PORT`, `PROTOCOL_VERSION`, `PLATFORM_JWKS_URL`, `TOKEN_ISSUER`, `TOKEN_AUDIENCE`,
`ALLOWED_ORIGIN` (defaults to `https://<GAME_ID>.play.croffle-play.link`).
