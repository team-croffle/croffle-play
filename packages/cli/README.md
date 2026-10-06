# @croffledev/play-cli

Checks a Croffle Play game before and after you deploy it, and uploads it for platform hosting. The
portal shows games in an iframe and reads their `game.json`; a game is served by its team or, from an
uploaded build, by the platform.

```bash
npx @croffledev/play-cli validate dist --api https://api.croffle-play.link
npx @croffledev/play-cli check https://<id>.play.croffle-play.link/ --portal https://game.croffle-play.link
npx @croffledev/play-cli pack dist                       # → <id>.zip
CROFFLE_DEPLOY_KEY=cdk_… npx @croffledev/play-cli deploy dist --api https://api.croffle-play.link
```

`pack` validates the build and zips it the way the platform expects (`game.json` at the root), refusing
what the platform would refuse first: symbolic links and more files or bytes than the limits allow.

`deploy` uploads a build (a directory, packed first, or a `.zip`) with the game's _deploy key_, issued
on the portal by an admin or a member of the game. The key is read from `CROFFLE_DEPLOY_KEY` only,
never from an argument. The platform makes the upload the game's active deploy; the admin page and
`/dev` show the history and roll back.

`validate` checks the build: `game.json` against the schema, that its entry and thumbnail exist (size
and format of the thumbnail are recommendations), and — with `--api` — that the SDK major still
accepts games (`old` and `deprecated` majors are refused).

`check` checks the deployed game the way the portal uses it: https, the entry answers 200, the game
lets the portal frame it (`Content-Security-Policy: frame-ancestors <portal>`, no
`X-Frame-Options: DENY`), and `<origin>/game.json` is valid with an id matching the host name.
`--insecure` allows http for local development. `--api` and `--portal` default to
`CROFFLE_PLAY_API` and `CROFFLE_PLAY_PORTAL`.
