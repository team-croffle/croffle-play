---
'@croffledev/play-sdk': minor
---

Add multiplayer: `sdk.joinRoom(room?, { maxPeers })` returns a `Room` (`send`, `on('message' | 'peer-join' | 'peer-leave' | 'host' | 'reconnecting' | 'reconnected' | 'closed')`, `peers`, `host`, `isHost`, `leave`). The SDK authenticates with a fresh game token as the first message, pings every 30 s, and reconnects with exponential backoff, re-joining the same room. Also `sdk.getToken()` for games with their own server. The mock host does not provide rooms.
