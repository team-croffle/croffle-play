# @croffledev/create-play-game

## 0.2.1

### Patch Changes

- f8c6777: Generated games pin pnpm in `packageManager`, so their CI (`pnpm/action-setup`) and Dockerfile
  (Corepack) work out of the box. The README lists the commands and links the developer guide and
  SDK reference; examples use the portal at `game.croffle-play.link`. The closing message describes
  self-hosting instead of the removed deploy keys.
- Updated dependencies [3281ea6]
  - @croffledev/play-protocol@0.2.1

## 0.2.0

### Minor Changes

- f3049ac: The template no longer has a publish workflow: teams host their games. It adds an optional `Dockerfile` + `Caddyfile` that serve the build and let only the portal frame it, and the README explains hosting and `play-cli check`.

### Patch Changes

- bcdb033: `game.json` declares a game's own server as `server: { url, protocol }` (https/wss; http/ws only on localhost). `needsServer`, `server.image`, `serverImageSchema`, and `SERVER_IMAGE_PREFIX` are gone: teams host their servers, and the platform only issues game tokens. The template's `game.json` drops `needsServer`.
- Updated dependencies [bcdb033]
- Updated dependencies [67a1154]
- Updated dependencies [690673e]
  - @croffledev/play-protocol@0.2.0

## 0.1.0

### Minor Changes

- e12ce69: New package: `npm create @croffledev/play-game <dir>` creates a game from the official template (Vite + TypeScript, SDK with mock host, `game.json`, publish and CI workflows, Renovate), filling in the game id, name, and the SDK and CLI versions of the same release.

### Patch Changes

- Updated dependencies [a5a8170]
- Updated dependencies [2abcd7e]
- Updated dependencies [ab609bc]
- Updated dependencies [07a1d45]
- Updated dependencies [f8b20df]
- Updated dependencies [97f91d5]
  - @croffledev/play-protocol@0.1.0
