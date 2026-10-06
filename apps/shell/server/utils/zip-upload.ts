import { UPLOAD_LIMITS } from '@croffledev/play-protocol';
import type { H3Event } from 'h3';

/** Why a request cannot be forwarded as a game build, or null when it can. */
export function zipUploadProblem(
  contentType: string | undefined,
  length: number,
  maxBytes = UPLOAD_LIMITS.maxZipBytes,
): string | null {
  if ((contentType ?? '').split(';')[0]?.trim() !== 'application/zip') {
    return 'Send the build as an application/zip body';
  }
  if (length === 0) {
    return 'The zip is empty';
  }
  if (length > maxBytes) {
    return `The zip is larger than ${maxBytes} bytes`;
  }
  return null;
}

/**
 * Forwards an uploaded game build (one zip) to the API as the signed-in player and returns the
 * API's answer. The API's own 4xx message is kept so the page can say why a build was refused.
 */
export async function relayZipUpload<T>(event: H3Event, apiPath: string): Promise<T> {
  const token = await accessToken(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  const body = await readRawBody(event, false);
  const problem = zipUploadProblem(getRequestHeader(event, 'content-type'), body?.length ?? 0);
  if (problem || !body) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message: problem },
    });
  }
  try {
    const res: unknown = await $fetch(apiPath, {
      baseURL: useRuntimeConfig().apiBase,
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/zip' },
      body,
    });
    return res as T;
  } catch (err) {
    return rethrowWithDetail(err);
  }
}

/** Like `rethrowApiError`, but keeps a 4xx body (`message`, `issues`) for the UI. */
export function rethrowWithDetail(err: unknown): never {
  const status = (err as { statusCode?: number }).statusCode;
  const data = (err as { data?: { message?: unknown; issues?: unknown } }).data;
  if (status && status >= 400 && status < 500 && data) {
    throw createError({ statusCode: status, statusMessage: 'Request failed', data });
  }
  return rethrowApiError(err);
}
