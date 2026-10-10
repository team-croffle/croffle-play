import type { ProtocolError } from '@croffledev/play-protocol';

/** Maps a failed core call to a protocol error the game can act on. */
export function toProtocolError(err: unknown): ProtocolError {
  const status = (err as { status?: unknown } | null)?.status;
  switch (status) {
    case 400:
    case 413:
    case 422:
      return { code: 'invalid_request', message: 'The platform rejected the request' };
    case 401:
      return { code: 'auth_required', message: 'Sign in to use this feature' };
    case 404:
      return { code: 'unsupported', message: 'Not available for this game' };
    case 429:
      return { code: 'rate_limited', message: 'Too many requests' };
    default:
      return { code: 'internal', message: 'Platform error' };
  }
}
