/**
 * Re-throws an API failure as an h3 error with the upstream status (502 when unreachable).
 * The upstream message is dropped: it contains the internal API URL.
 */
export function rethrowApiError(err: unknown): never {
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    throw createError({
      statusCode: status,
      statusMessage: status === 404 ? 'Not Found' : 'Bad Request',
    });
  }
  throw createError({ statusCode: 502, statusMessage: 'Platform API unavailable' });
}
