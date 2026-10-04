import type { SessionUser } from '~~/server/utils/session';

/** The signed-in player (shared across the app), loaded from the shell session. */
export function useMe() {
  return useFetch<{ user: SessionUser | null }>('/api/me', {
    key: 'me',
    headers: useRequestHeaders(['cookie']),
    default: () => ({ user: null }),
  });
}

/** Full-page navigation to sign-in, returning to `path` afterwards. */
export function loginHref(path: string): string {
  return `/auth/login?return=${encodeURIComponent(path)}`;
}
