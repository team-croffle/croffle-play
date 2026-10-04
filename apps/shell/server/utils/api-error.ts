const messages: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
};

/**
 * Re-throws an API failure as an h3 error with the upstream 4xx status (502 otherwise).
 * The upstream message is dropped: it contains the internal API URL.
 */
export function rethrowApiError(err: unknown): never {
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    throw createError({ statusCode: status, statusMessage: messages[status] ?? 'Bad Request' });
  }
  throw createError({ statusCode: 502, statusMessage: 'Platform API unavailable' });
}

/** Runs an API call and maps its failure (see `rethrowApiError`). */
export async function proxied<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    rethrowApiError(err);
  }
}
