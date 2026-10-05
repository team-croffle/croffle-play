---
'@croffledev/play-sdk': major
---

SDK v1 (`1.0.0`): the package major is the SDK major the platform registers and serves an adapter for. Initial SDK v1 client: `createSdk({ game })` performs the `__hello`/`__welcome` handshake with the parent window, pins the host origin, and exposes `has()`, `ready()`, `getUser()`, `submitScore()`, `save()`, `load()`, `exit()`, `setFullscreen()`, and `pause`/`resume` events. Requests are validated locally and time out after 10 s.

Adds `@croffledev/play-sdk/mock`: `createMockHost()` runs a game without the platform (fake user, localStorage saves, guest mode, `emit('pause' | 'resume')`), validating payloads like the real host.
