/** The game's uploads, newest first, for its members. */
export default defineEventHandler((event) =>
  apiAsUser(event, `/v1/me/games/${gameIdParam(event)}/deploys`),
);
