/** State-changing `/api` requests only from this site's own pages (server/utils/request-guard.ts). */
export default defineEventHandler((event) => {
  const allowed = isAllowedRequest({
    method: event.method,
    path: event.path,
    origin: getRequestHeader(event, 'origin'),
    host: getRequestHost(event, { xForwardedHost: true }),
  });
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request refused' });
  }
});
