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
