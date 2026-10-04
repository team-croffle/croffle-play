import type { H3Event } from 'h3';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Calls the platform API as the signed-in player; 401 when signed out. */
export async function apiAsUser<T>(
  event: H3Event,
  path: string,
  init: { method?: Method; body?: unknown; token?: string } = {},
): Promise<T> {
  const token = init.token ?? (await accessToken(event));
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  try {
    const res: unknown = await $fetch(path, {
      baseURL: useRuntimeConfig().apiBase,
      method: init.method ?? 'GET',
      headers: { authorization: `Bearer ${token}` },
      ...(init.body === undefined ? {} : { body: init.body as Record<string, unknown> }),
    });
    return res as T;
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      await (await useShellSession(event)).update({ auth: undefined });
    }
    return rethrowApiError(err);
  }
}
