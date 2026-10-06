/** Issues a deploy key for the game (CI, `play-cli deploy`), as a member. */
export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { label?: unknown } | undefined;
  const label = typeof body?.label === 'string' ? body.label.slice(0, 80) : '';
  return apiAsUser(event, `/v1/me/games/${gameIdParam(event)}/deploy-keys`, {
    method: 'POST',
    body: { label },
  });
});
