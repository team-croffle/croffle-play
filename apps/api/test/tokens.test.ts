import { createLocalJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('game tokens', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true, env: { PUBLIC_API_ORIGIN: 'https://api.test' } });
  });

  afterAll(async () => {
    await t.close();
  });

  const issue = async (game: string, sub = 'idp|alice') =>
    t.app.inject({ method: 'POST', url: `/v1/games/${game}/token`, headers: await bearerFor(sub) });

  it('publishes a JWKS without private material', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/.well-known/jwks.json' });
    expect(res.statusCode).toBe(200);
    const { keys } = res.json<{ keys: Record<string, string>[] }>();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({
      kty: 'EC',
      crv: 'P-256',
      alg: 'ES256',
      use: 'sig',
      kid: 'game-1',
    });
    expect(keys[0]?.d).toBeUndefined();
  });

  it('issues a short-lived token scoped to one game, verifiable with the JWKS', async () => {
    const res = await issue('sample');
    expect(res.statusCode).toBe(201);
    const { token, expiresAt } = res.json<{ token: string; expiresAt: string }>();
    const jwks = createLocalJWKSet(
      (await t.app.inject({ method: 'GET', url: '/.well-known/jwks.json' })).json(),
    );
    const { payload } = await jwtVerify(token, jwks, {
      issuer: 'https://api.test',
      audience: 'game:sample',
    });
    expect(payload.sub).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.nickname).toMatch(/^player-/);
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(600);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
    expect(decodeProtectedHeader(token).kid).toBe('game-1');
    await expect(jwtVerify(token, jwks, { audience: 'game:block-drop' })).rejects.toThrow();
  });

  it('requires sign-in and an existing game', async () => {
    expect((await t.app.inject({ method: 'POST', url: '/v1/games/sample/token' })).statusCode).toBe(
      401,
    );
    expect((await issue('nope')).statusCode).toBe(404);
  });
});
