/** Uploads a game build (zip) for platform hosting, as a member of the game. */
export default defineEventHandler((event) =>
  relayZipUpload(event, `/v1/me/games/${gameIdParam(event)}/deploys`),
);
