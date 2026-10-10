# @croffledev/play-adapter-v1

The host adapter for SDK major 1 of [Croffle Play](https://github.com/team-croffle/croffle-play).
The portal loads it at runtime (SRI-checked, from the platform's own origin) to translate messages
from games built on `@croffledev/play-sdk` 1.x into platform API calls. Games never import it.

The package is a bundle, not a library: `dist/index.js` plus `dist/manifest.json` (`major`,
`version`, `integrity`, and `requiresApi` — the platform API versions it can talk to). The platform
api reads this package from npm, verifies it and registers it; see the admin guide.

Versioned together with `@croffledev/play-sdk` (Changesets linked group).
