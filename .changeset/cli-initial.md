---
'@croffledev/play-cli': minor
---

Initial `play-cli`: `validate [dir]` checks a bundle against the `game.json` contract, entry and thumbnail presence, the size limit, external resource references, and (with `--api`) the SDK lifecycle; `publish [dir]` validates, uploads through presigned URLs with retries, and completes the version. Deploy key from `CROFFLE_PLAY_DEPLOY_KEY`.
