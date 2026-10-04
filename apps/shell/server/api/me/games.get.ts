/** The signed-in player's games (team membership) with things to act on. */
export default defineEventHandler((event) => apiAsUser(event, '/v1/me/games'));
