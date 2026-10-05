# @croffledev/create-play-game

Starts a new [Croffle Play](https://github.com/team-croffle/croffle-play) game.

```bash
npm create @croffledev/play-game tetris
# or: pnpm create @croffledev/play-game tetris -- --name "Tetris"
```

The game id defaults to the directory name (lowercase letters, digits, inner hyphens). The new
folder is a complete Vite + TypeScript game that runs on its own with the SDK mock host
(`pnpm dev`), with `game.json`, a publish workflow (tag `vX.Y.Z` → `play-cli publish`), and
Renovate. It depends on the SDK and CLI versions released together with this package. Push it to
its own repository; see its README for publishing.
