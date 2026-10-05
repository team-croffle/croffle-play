/** `/adapters/v<N>/<version>/index.js` → API `/v1/adapters/…` (design invariant 6). */
export default defineEventHandler((event) => {
  const path = getRouterParam(event, 'path') ?? '';
  if (!/^v[1-9][0-9]{0,2}\/[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?\/index\.js$/.test(path)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  return relayStoredFile(event, `/v1/adapters/${path}`);
});
