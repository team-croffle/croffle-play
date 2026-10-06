/** Uploads a game build (zip) for platform hosting, as an admin. */
export default defineEventHandler((event) =>
  relayZipUpload(event, `/v1/admin/games/${gameIdParam(event)}/deploys`),
);
