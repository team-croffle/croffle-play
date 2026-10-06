# Croffle Play game

A game for [Croffle Play](https://github.com/team-croffle/croffle-play), created with
`npm create @croffledev/play-game`. Players open it from the portal, which shows it in an iframe and
gives it the platform account, scores, saves, and rooms through `@croffledev/play-sdk`.

1. Check the game id and name in `game.json` and push this folder to its own GitHub repository.
2. `pnpm install && pnpm dev` — runs the game alone with the SDK mock host (fake player, local saves).
3. Build anything you like in `src/`. Talk to the platform only through the SDK, and check features
   with `sdk.has('score')`, never by comparing versions.

## Hosting

The game lives at `https://<id>.play.croffle-play.link/`. Two ways to get it there:

- **Platform hosting** — upload the build and the platform serves it. Ask an admin (or a member of
  the game on the portal's `/dev` page) for a _deploy key_, then:

  ```bash
  pnpm build
  CROFFLE_DEPLOY_KEY=cdk_… CROFFLE_PLAY_API=https://api.croffle-play.link pnpm deploy:play
  ```

  `.github/workflows/deploy.yml` does the same on every push to `main` once the repository has the
  secret `CROFFLE_DEPLOY_KEY` and the variable `CROFFLE_PLAY_API`; without them it is skipped.

- **Team hosting** — you host the build yourself (ask a platform admin to point the name at your
  host). Any static host works; `Dockerfile` + `Caddyfile` here is one option.

A team-hosted site must:

- serve `dist/` at the root of the origin, including `game.json` (the portal reads it);
- let the portal frame the game: `Content-Security-Policy: frame-ancestors https://game.croffle-play.link`
  (the `Caddyfile` does this), and never send `X-Frame-Options: DENY`;
- use https.

Before and after deploying:

```bash
pnpm build && pnpm validate                       # game.json, entry, thumbnail (public/thumb.png)
pnpm exec play-cli check https://<id>.play.croffle-play.link/ --portal https://game.croffle-play.link
```

Then ask a platform admin to register the game. They refresh `game.json` after you deploy a new
SDK major; content updates need nothing from the platform.

Renovate keeps the SDK up to date. A new SDK major comes with a migration guide and a codemod.

## Commands

| Command            | Does                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`         | Runs the game alone with the SDK mock host                                                                      |
| `pnpm build`       | Builds `dist/` and writes `dist/game.json`                                                                      |
| `pnpm preview`     | Serves `dist/` locally                                                                                          |
| `pnpm typecheck`   | TypeScript check                                                                                                |
| `pnpm validate`    | `play-cli validate dist`: game.json, entry, SDK major                                                           |
| `pnpm deploy:play` | `play-cli deploy dist`: uploads the build for platform hosting (needs `CROFFLE_DEPLOY_KEY`, `CROFFLE_PLAY_API`) |

## Docs (Korean)

- [Game developer guide](https://github.com/team-croffle/croffle-play/blob/master/docs/guide/developer.md) — from this template to a listed game
- [SDK reference](https://github.com/team-croffle/croffle-play/blob/master/docs/reference/sdk.md)
- [Hosting and registration](https://github.com/team-croffle/croffle-play/blob/master/docs/game-hosting.md) · [Multiplayer](https://github.com/team-croffle/croffle-play/blob/master/docs/multiplayer.md) ·
  [Own game server](https://github.com/team-croffle/croffle-play/blob/master/docs/game-servers.md) · [SDK lifecycle](https://github.com/team-croffle/croffle-play/blob/master/docs/sdk-lifecycle.md)
