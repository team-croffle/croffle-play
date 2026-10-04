# @croffledev/play-cli

Validates and publishes Croffle Play game bundles. Normally run by the game repository's publish
workflow (from the game template), not by hand.

```bash
npx @croffledev/play-cli validate dist --api https://api.play.croffledev.kr
CROFFLE_PLAY_DEPLOY_KEY=cpk_… npx @croffledev/play-cli publish dist --api https://api.play.croffledev.kr
```

`validate` checks `game.json` against the bundle contract, that the entry and thumbnail exist, the
size limit (30 MB unless raised by an admin), references to external resources, and — with
`--api` — that the SDK major is still accepted. `publish` validates, uploads every file through
presigned URLs (each bound to the file's size and SHA-256), and completes the version, which then
waits for admin approval.
