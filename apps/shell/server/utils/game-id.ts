import { isValidGameId } from '@croffledev/play-protocol';
import type { H3Event } from 'h3';

/** The `:id` route parameter, or a 404 when it cannot be a game id (reserved or malformed). */
export function gameIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? '';
  if (!isValidGameId(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  return id;
}

/** The `:key` route parameter (a UUID), or a 404. */
export function keyIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'key') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
  return id;
}
