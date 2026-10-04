const methods = new Set(['GET', 'POST', 'PATCH', 'DELETE']);

/** Forwards `/api/admin/<path>` to `/v1/admin/<path>` as the signed-in player (the API requires the admin role). */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') ?? '';
  if (!methods.has(event.method) || !/^[\w./-]+$/.test(path) || path.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
  }
  const method = event.method as 'GET' | 'POST' | 'PATCH' | 'DELETE';
  const body = method === 'GET' || method === 'DELETE' ? undefined : await readBody(event);
  const result = await adminFetch(event, path, { method, body });
  if (result === undefined || result === null || result === '') {
    setResponseStatus(event, 204);
    return null;
  }
  return result;
});
