/**
 * Where a game lives. Every game has its own origin, built from one template such as
 * `https://{id}.play.croffle-play.link` (`{id}` is a validated DNS label), so the platform never
 * fetches or frames an arbitrary host.
 */

/** `https://tetris.play.example` for `('https://{id}.play.example', 'tetris')`. */
export function gameOrigin(template: string, id: string): string {
  return template.replaceAll('{id}', id).replace(/\/+$/, '');
}

/** Absolute URL of a path inside the game site (`index.html`, `thumb.png`, …). */
export function gameUrl(template: string, id: string, path = ''): string {
  return new URL(path, `${gameOrigin(template, id)}/`).href;
}

/** Where the game serves its `game.json`. */
export function manifestUrl(template: string, id: string): string {
  return gameUrl(template, id, 'game.json');
}
