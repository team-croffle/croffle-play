/** The approved game server's compose fragment, as a download. */
export default defineEventHandler(async (event) => {
  const id = gameIdParam(event);
  const yaml = await adminFetch<string>(event, `games/${id}/server/compose`);
  setResponseHeaders(event, {
    'Content-Type': 'text/yaml; charset=utf-8',
    'Content-Disposition': `attachment; filename="${id}.yml"`,
  });
  return yaml;
});
