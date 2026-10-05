# @croffledev/play-protocol

Message contract between Croffle Play games and the platform.

- `handshake` — `__hello { sdk, game }` / `__welcome { capabilities }`. Frozen forever.
- `v1` — request/response/event envelopes and payload schemas (valibot) for SDK major 1.
- `capabilities` — feature names announced in `__welcome`.
- `@croffledev/play-protocol/host` — types for the portal core ↔ host adapter contract.

Games use [`@croffledev/play-sdk`](../sdk) instead of this package directly.
