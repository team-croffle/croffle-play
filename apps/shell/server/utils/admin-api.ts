import type { H3Event } from 'h3';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Calls `/v1/admin/<path>` as the signed-in player; the API requires the admin role. */
export async function adminFetch<T>(
  event: H3Event,
  path: string,
  init: { method?: Method; body?: unknown } = {},
): Promise<T> {
  const token = await accessToken(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  try {
    const res: unknown = await $fetch(`/v1/admin/${path}`, {
      baseURL: useRuntimeConfig().apiBase,
      method: init.method ?? 'GET',
      headers: { authorization: `Bearer ${token}` },
      ...(init.body === undefined ? {} : { body: init.body as Record<string, unknown> }),
    });
    return res as T;
  } catch (err) {
    // Keep the API's validation details for the admin UI.
    const data = (err as { data?: { message?: unknown; issues?: unknown; problems?: unknown } })
      .data;
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500 && data) {
      throw createError({ statusCode: status, statusMessage: 'Request failed', data });
    }
    return rethrowApiError(err);
  }
}
