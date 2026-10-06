/** Revokes a deploy key, as a member. */
export default defineEventHandler(async (event) => {
  await apiAsUser(event, `/v1/me/games/${gameIdParam(event)}/deploy-keys/${keyIdParam(event)}`, {
    method: 'DELETE',
  });
  setResponseStatus(event, 204);
  return null;
});
