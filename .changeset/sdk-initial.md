---
'@croffledev/play-sdk': minor
---

Initial SDK v1 client: `createSdk({ game })` performs the `__hello`/`__welcome` handshake with the parent window, pins the host origin, and exposes `has()`, `ready()`, `getUser()`, `submitScore()`, `save()`, `load()`, `exit()`, `setFullscreen()`, and `pause`/`resume` events. Requests are validated locally and time out after 10 s.
