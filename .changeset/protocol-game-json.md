---
'@croffledev/play-protocol': minor
---

`game.json` is now what a self-hosted game serves at `<game origin>/game.json` for the portal to read: `version` and `thumbnail` are optional. Adds `gameOrigin`, `gameUrl`, and `manifestUrl`, which build a game's addresses from one `{id}` template. `srv` and `preview` are no longer reserved game ids.
