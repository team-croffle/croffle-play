/** Rotates a deploy key (new key now, the old one expires in 24 hours), as a member. */
export default defineEventHandler((event) =>
  apiAsUser(event, `/v1/me/games/${gameIdParam(event)}/deploy-keys/${keyIdParam(event)}/rotate`, {
    method: 'POST',
  }),
);
