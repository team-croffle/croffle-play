# Game server fragments (Tier 2)

Approved game servers run as their own compose services next to the platform stack. Download a
game's fragment from the admin page (or `GET /v1/admin/games/<id>/server/compose`) into this
directory as `<id>.yml` — the files are generated, so they are not committed — then:

```bash
docker compose -f infra/compose.yml -f infra/game-servers/<id>.yml up -d game-<id>
```

Every fragment runs the approved image read-only as a non-root user with no capabilities, bounded
CPU/memory/pids, on `games-net` only (no database, storage, or platform networks), behind the
reverse proxy at `<id>.srv.croffle-play.link` with `Set-Cookie` stripped. Revoking an approval
does not stop a running container: stop it with `docker compose … stop game-<id>`.
