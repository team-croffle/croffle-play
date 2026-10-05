# @croffledev/play-cli

## 0.1.0

### Minor Changes

- 168d029: Initial `play-cli`: `validate [dir]` checks a bundle against the `game.json` contract, entry and thumbnail presence, the size limit, external resource references, and (with `--api`) the SDK lifecycle; `publish [dir]` validates, uploads through presigned URLs with retries, and completes the version. Deploy key from `CROFFLE_PLAY_DEPLOY_KEY`.
- 97f91d5: Thumbnail rules: `THUMBNAIL` limits in the protocol (PNG/JPEG/WebP, at most 512 KB, at least 256×144). `play-cli validate` reads the image header to check format and size.

### Patch Changes

- 45a267d: `publish` prints warnings returned by the platform (for example, an SDK major in maintenance with its end-of-life date).
- a5a8170: Tier 2 game servers: `game.json` `server.image` (from `ghcr.io/team-croffle/`, pinned tag or digest, never `latest`) is required when `needsServer` is true, and v1 `getServerInfo` (capability `server`, `sdk.getServerInfo()`) tells a game where its approved server is. `play-cli validate` enforces the new manifest rule.
- Updated dependencies [a5a8170]
- Updated dependencies [2abcd7e]
- Updated dependencies [ab609bc]
- Updated dependencies [07a1d45]
- Updated dependencies [f8b20df]
- Updated dependencies [97f91d5]
  - @croffledev/play-protocol@0.1.0
