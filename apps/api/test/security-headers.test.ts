import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('API response headers', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
  });

  afterAll(async () => {
    await t.close();
  });

  it('sets defensive headers on every response, errors included', async () => {
    for (const url of ['/v1/games', '/v1/games/nope', '/healthz']) {
      const res = await t.app.inject({ method: 'GET', url });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
      expect(res.headers['referrer-policy']).toBe('no-referrer');
    }
  });

  it('never lets caches keep authenticated responses', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: await bearerFor('idp|a'),
    });
    expect(res.headers['cache-control']).toBe('no-store');
    const jwks = await t.app.inject({ method: 'GET', url: '/.well-known/jwks.json' });
    expect(jwks.headers['cache-control']).toBe('public, max-age=300');
  });

  it('does not answer cross-origin preflights', async () => {
    const res = await t.app.inject({
      method: 'OPTIONS',
      url: '/v1/me',
      headers: { origin: 'https://evil.test', 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
