import { randomBytes } from 'node:crypto';

import type { H3Event } from 'h3';
import type { Storage } from 'unstorage';

/** Signed-in player, as the API knows them. Games get only id/nickname/avatar. */
export interface SessionUser {
  id: string;
  nickname: string;
  avatar: string | null;
  role: 'user' | 'admin';
}

export interface ShellSession {
  /** In-flight sign-in (PKCE verifier, state, nonce). */
  oidc?: { verifier: string; state: string; nonce: string; returnTo: string };
  /** Tokens stay here, server-side; the browser only holds the sealed cookie. */
  auth?: { accessToken: string; refreshToken?: string; expiresAt: number; user: SessionUser };
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
 * Name and options of the session cookie. Over https it is `__Host-`: bound to the portal host, no
 * Domain attribute, so game hosts on the same site (`<id>.play.<domain>`) never receive it.
 */
export function sessionCookie(siteUrl: string) {
  const secure = siteUrl.startsWith('https://');
  return {
    name: secure ? '__Host-cp_session' : 'cp_session',
    cookie: { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' },
  };
}

/** What callers use: the h3 cookie session, or the same shape backed by the session store. */
export interface ShellSessionHandle {
  readonly data: ShellSession;
  update(patch: Partial<ShellSession>): Promise<unknown>;
  clear(): Promise<unknown>;
}

/**
 * The player's session. Sealed, HttpOnly cookie; with a session store (server/utils/session-store.ts)
 * the cookie holds only the session id and the data stays on the server. Either way the browser and
 * games never see tokens (design invariant 4).
 */
export async function useShellSession(event: H3Event): Promise<ShellSessionHandle> {
  const config = useRuntimeConfig();
  const maxAge = Number(config.sessionMaxAge) || 43_200;
  const cookie = await useSession<ShellSession>(event, {
    password: password(),
    maxAge,
    ...sessionCookie(config.siteUrl),
  });
  const store = sessionStore();
  if (!store) {
    return cookie;
  }
  return storedSession(store, cookie, maxAge);
}

/** Session data in `store` under the cookie session's id (expires with the cookie). */
export async function storedSession(
  store: Storage,
  cookie: { id?: string; update(patch: object): Promise<unknown>; clear(): Promise<unknown> },
  maxAge: number,
): Promise<ShellSessionHandle> {
  const key = () => cookie.id ?? '';
  let data: ShellSession = (cookie.id && (await store.getItem<ShellSession>(key()))) || {};
  return {
    get data() {
      return data;
    },
    async update(patch) {
      data = { ...data, ...patch };
      // Seals and sets the cookie (with its id) if this is a new session.
      await cookie.update({});
      await store.setItem(key(), data, { ttl: maxAge });
    },
    async clear() {
      if (cookie.id) {
        await store.removeItem(key());
      }
      data = {};
      await cookie.clear();
    },
  };
}
