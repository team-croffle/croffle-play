import { generateKeyPair } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UsersService } from '../src/users/users.service.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { accessToken, bearerFor } from './support/test-issuer.js';

describe('/v1/me', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  const me = (headers: Record<string, string> = {}) =>
    t.app.inject({ method: 'GET', url: '/v1/me', headers });

  it('creates the account on first sight and never exposes the subject', async () => {
    const res = await me(await bearerFor('idp|alice'));
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; nickname: string; role: string }>();
    expect(body).toMatchObject({
      nickname: expect.stringMatching(/^player-[0-9a-f]{6}$/),
      avatar: null,
      role: 'user',
    });
    expect(JSON.stringify(body)).not.toContain('alice');
    expect((await me(await bearerFor('idp|alice'))).json<{ id: string }>().id).toBe(body.id);
  });

  it('refuses missing, expired, foreign, and forged tokens', async () => {
    const forged = (await generateKeyPair('ES256')).privateKey;
    for (const headers of [
      {},
      { authorization: 'Bearer nope' },
      { authorization: `Bearer ${await accessToken('x', { expiresIn: '-1m' })}` },
      { authorization: `Bearer ${await accessToken('x', { aud: 'https://other.test' })}` },
      { authorization: `Bearer ${await accessToken('x', { iss: 'https://evil.test' })}` },
      { authorization: `Bearer ${await accessToken('x', { key: forged })}` },
    ]) {
      expect((await me(headers)).statusCode).toBe(401);
    }
  });

  it('updates the profile with validation', async () => {
    const auth = await bearerFor('idp|bob');
    const put = (payload: object) =>
      t.app.inject({ method: 'PUT', url: '/v1/me', headers: auth, payload });
    expect(
      (await put({ nickname: ' Bob ', avatar: 'https://cdn.test/b.png' })).json(),
    ).toMatchObject({
      nickname: 'Bob',
      avatar: 'https://cdn.test/b.png',
    });
    expect((await put({ nickname: '', avatar: null })).statusCode).toBe(400);
    expect((await put({ nickname: 'x', avatar: 'javascript:alert(1)' })).statusCode).toBe(400);
    expect((await put({ nickname: 'x', avatar: 'http://insecure.test/a.png' })).statusCode).toBe(
      400,
    );
  });

  it('promotes ADMIN_SUBS on sign-in', async () => {
    const t2 = await createTestApp({ env: { ADMIN_SUBS: 'idp|boss, idp|other' } });
    try {
      const res = await t2.app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: await bearerFor('idp|boss'),
      });
      expect(res.json()).toMatchObject({ role: 'admin' });
    } finally {
      await t2.close();
    }
  });

  it('grants admin by subject', async () => {
    await me(await bearerFor('idp|carol'));
    const users = t.app.get(UsersService);
    expect((await users.grantAdmin('idp|carol'))?.role).toBe('admin');
    expect(await users.grantAdmin('idp|nobody')).toBeNull();
    expect((await me(await bearerFor('idp|carol'))).json()).toMatchObject({ role: 'admin' });
  });
});
