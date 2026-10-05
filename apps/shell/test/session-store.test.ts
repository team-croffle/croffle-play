import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';
import { describe, expect, it } from 'vitest';

import { storedSession } from '../server/utils/session';

/** Stands in for the h3 cookie session: an id, and whatever data ends up in the cookie. */
function fakeCookie(id?: string) {
  const cookie = {
    id,
    data: {} as Record<string, unknown>,
    updates: 0,
    async update(patch: object) {
      cookie.id ??= 'sid-1';
      cookie.updates++;
      Object.assign(cookie.data, patch);
    },
    async clear() {
      cookie.id = undefined;
      cookie.data = {};
    },
  };
  return cookie;
}

const auth = {
  accessToken: 'secret-token',
  expiresAt: 1,
  user: { id: 'u', nickname: 'n', avatar: null, role: 'user' as const },
};

describe('session data in a Redis-protocol store', () => {
  it('keeps tokens in the store; the cookie carries only the session id', async () => {
    const store = createStorage({ driver: memoryDriver() });
    const cookie = fakeCookie();
    const session = await storedSession(store, cookie, 60);
    await session.update({ auth });
    expect(cookie.id).toBe('sid-1');
    expect(cookie.data).toEqual({});
    expect(await store.getItem('sid-1')).toEqual({ auth });

    const again = await storedSession(store, fakeCookie('sid-1'), 60);
    expect(again.data.auth?.accessToken).toBe('secret-token');
  });

  it('merges updates and forgets everything on clear', async () => {
    const store = createStorage({ driver: memoryDriver() });
    const cookie = fakeCookie();
    const session = await storedSession(store, cookie, 60);
    await session.update({ auth });
    await session.update({ oidc: { verifier: 'v', state: 's', nonce: 'n', returnTo: '/' } });
    expect(session.data).toMatchObject({ auth, oidc: { state: 's' } });
    await session.clear();
    expect(session.data).toEqual({});
    expect(await store.getKeys()).toEqual([]);
    expect(cookie.id).toBeUndefined();
  });

  it('starts empty for an unknown or missing id', async () => {
    const store = createStorage({ driver: memoryDriver() });
    expect((await storedSession(store, fakeCookie('gone'), 60)).data).toEqual({});
    expect((await storedSession(store, fakeCookie(), 60)).data).toEqual({});
  });
});
