/**
 * State-changing `/api` requests must come from this site's own pages. SameSite=Lax already keeps
 * the session cookie off cross-site POSTs; this also stops same-site neighbours.
 */
export default defineEventHandler((event) => {
  const method = event.method;
  if (!event.path.startsWith('/api/') || method === 'GET' || method === 'HEAD') {
    return;
  }
  const origin = getRequestHeader(event, 'origin');
  const host = getRequestHost(event, { xForwardedHost: true });
  if (!origin || new URL(origin).host !== host) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request refused' });
  }
});
