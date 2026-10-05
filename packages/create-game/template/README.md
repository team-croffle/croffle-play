# Croffle Play game

A game for [Croffle Play](https://github.com/team-croffle/croffle-play), created with
`npm create @croffledev/play-game`. Next:

1. Check the game id and name in `game.json` and ask a platform admin to register the id. Push this
   folder to its own GitHub repository.
2. `pnpm install && pnpm dev` — runs the game alone with the SDK mock host (fake player, local saves).
3. Build anything you like in `src/`. Talk to the platform only through `@croffledev/play-sdk`.

## Rules for bundles

- Every path relative (Vite `base: './'`), nothing loaded from other hosts, no cookies.
- `game.json`, the entry (`index.html`), and the thumbnail (`public/thumb.png`, at least 256×144)
  must be in `dist/`. Default size limit: 30 MB.
- Check features with `sdk.has('score')`, never by comparing versions.

`pnpm build && pnpm validate` checks all of this locally.

## Publishing

1. Ask a platform admin for the game's **deploy key**; add it as the repository secret
   `CROFFLE_PLAY_DEPLOY_KEY`. Set the repository variable `CROFFLE_PLAY_API`
   (e.g. `https://api.play.croffledev.kr`).
2. Tag a release: `git tag v1.0.0 && git push origin v1.0.0`.
3. The **Publish** workflow builds, validates, and uploads the version. It appears as a preview for
   admins; once approved it goes live. Versions are immutable: fix a bug with a new tag.

Renovate keeps the SDK up to date. A new SDK major comes with a migration guide and a codemod.
