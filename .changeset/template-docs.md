---
'@croffledev/create-play-game': patch
---

Generated games pin pnpm in `packageManager`, so their CI (`pnpm/action-setup`) and Dockerfile
(Corepack) work out of the box. The README lists the commands and links the developer guide and
SDK reference; examples use the portal at `game.croffle-play.link`. The closing message describes
self-hosting instead of the removed deploy keys.
