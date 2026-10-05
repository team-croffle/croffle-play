# Croffle Play game

A game for [Croffle Play](https://github.com/team-croffle/croffle-play), created with
`npm create @croffledev/play-game`. Players open it from the portal, which shows it in an iframe and
gives it the platform account, scores, saves, and rooms through `@croffledev/play-sdk`.

1. Check the game id and name in `game.json` and push this folder to its own GitHub repository.
2. `pnpm install && pnpm dev` — runs the game alone with the SDK mock host (fake player, local saves).
3. Build anything you like in `src/`. Talk to the platform only through the SDK, and check features
   with `sdk.has('score')`, never by comparing versions.

## Hosting

You host the game yourself, at `https://<id>.play.croffle-play.link/` (ask a platform admin to point
the name at your host). Any static host works; `Dockerfile` + `Caddyfile` here is one option.

The host must:

- serve `dist/` at the root of the origin, including `game.json` (the portal reads it);
- let the portal frame the game: `Content-Security-Policy: frame-ancestors https://www.croffle-play.link`
  (the `Caddyfile` does this), and never send `X-Frame-Options: DENY`;
- use https.

Before and after deploying:

```bash
pnpm build && pnpm validate                       # game.json, entry, thumbnail (public/thumb.png)
pnpm exec play-cli check https://<id>.play.croffle-play.link/ --portal https://www.croffle-play.link
```

Then ask a platform admin to register the game. They refresh `game.json` after you deploy a new
SDK major; content updates need nothing from the platform.

Renovate keeps the SDK up to date. A new SDK major comes with a migration guide and a codemod.
