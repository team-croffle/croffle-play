import { randomBytes } from 'node:crypto';

import type { H3Event } from 'h3';

export interface ShellSession {
  /** Temporary admin credential, until accounts and roles exist. */
  adminToken?: string;
}

// Development without NUXT_SESSION_PASSWORD: a per-process secret (sessions end on restart).
let devPassword: string | undefined;

function password(): string {
  const configured = useRuntimeConfig().sessionPassword;
  if (configured) {
    if (configured.length < 32) {
      throw createError({ statusCode: 500, statusMessage: 'NUXT_SESSION_PASSWORD is too short' });
    }
    return configured;
  }
  if (import.meta.dev) {
    devPassword ??= randomBytes(32).toString('hex');
    return devPassword;
  }
  throw createError({ statusCode: 500, statusMessage: 'NUXT_SESSION_PASSWORD is not set' });
}

/**
 * Sealed, HttpOnly session cookie. Holds credentials server-side only; the browser and games never
 * see tokens (design invariant 4).
 */
export function useShellSession(event: H3Event) {
  const secure = !import.meta.dev;
  return useSession<ShellSession>(event, {
    password: password(),
    // `__Host-` pins the cookie to this host over HTTPS (no Domain attribute possible).
    name: secure ? '__Host-cp_session' : 'cp_session',
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure, sameSite: 'lax', path: '/' },
  });
}
