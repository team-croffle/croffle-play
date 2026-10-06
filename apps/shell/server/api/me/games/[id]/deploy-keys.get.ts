/** The game's deploy keys (hashes only; the raw key is shown once at issue), for its members. */
export default defineEventHandler((event) =>
  apiAsUser(event, `/v1/me/games/${gameIdParam(event)}/deploy-keys`),
);
