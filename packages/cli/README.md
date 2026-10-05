# @croffledev/play-cli

Checks a Croffle Play game before and after you deploy it. Games are hosted by their teams; the
portal shows them in an iframe and reads their `game.json`.

```bash
npx @croffledev/play-cli validate dist --api https://api.croffle-play.link
npx @croffledev/play-cli check https://<id>.play.croffle-play.link/ --portal https://www.croffle-play.link
```

`validate` checks the build: `game.json` against the schema, that its entry and thumbnail exist (size
and format of the thumbnail are recommendations), and — with `--api` — that the SDK major still
accepts games (`old` and `deprecated` majors are refused).

`check` checks the deployed game the way the portal uses it: https, the entry answers 200, the game
lets the portal frame it (`Content-Security-Policy: frame-ancestors <portal>`, no
`X-Frame-Options: DENY`), and `<origin>/game.json` is valid with an id matching the host name.
`--insecure` allows http for local development. `--api` and `--portal` default to
`CROFFLE_PLAY_API` and `CROFFLE_PLAY_PORTAL`.
