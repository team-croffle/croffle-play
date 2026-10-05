/** `/avatars/<user>/<hash>.<ext>` → API `/v1/avatars/…`, on the portal's own origin. */
export default defineEventHandler((event) => {
  const path = getRouterParam(event, 'path') ?? '';
  if (!/^[0-9a-f-]{36}\/[0-9a-f]{32}\.(png|jpeg|webp)$/.test(path)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  return relayStoredFile(event, `/v1/avatars/${path}`);
});
