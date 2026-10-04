/** Base URL of one game version, from `GAME_URL_TEMPLATE`. */
export function gameBaseUrl(template: string, id: string, version: string): string {
  return template.replaceAll('{id}', id).replaceAll('{version}', encodeURIComponent(version));
}
