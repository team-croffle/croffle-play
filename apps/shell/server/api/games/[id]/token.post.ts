/** Game-scoped token for the signed-in player (rooms, game servers); 401 for guests. */
export default defineEventHandler((event) => {
  const id = gameIdParam(event);
  return apiAsUser(event, `/v1/games/${id}/token`, { method: 'POST' });
});
