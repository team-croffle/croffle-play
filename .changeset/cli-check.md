---
'@croffledev/play-cli': minor
---

Games are hosted by their teams now, so `publish` is gone. `validate` checks a build's `game.json`, entry, and thumbnail (size and format are warnings) and refuses `old` or `deprecated` SDK majors with `--api`. New `check <url>` verifies a deployed game: https, framable by the portal (`frame-ancestors`), and a `game.json` whose id matches the host.
