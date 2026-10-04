import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('rate limits', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true, env: { RATE_LIMITS: 'true' } });
  });

  afterAll(async () => {
    await t.close();
  });

  const score = async (sub: string) =>
    t.app.inject({
      method: 'POST',
      url: '/v1/games/sample/scores',
      headers: await bearerFor(sub),
      payload: { score: 1 },
    });

  it('limits each player separately, even behind one shell IP', async () => {
    for (let i = 0; i < 30; i++) {
      expect((await score('idp|spammer')).statusCode).toBe(201);
    }
    const blocked = await score('idp|spammer');
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await score('idp|someone-else')).statusCode).toBe(201);
  });

  it('leaves reads alone', async () => {
    for (let i = 0; i < 150; i++) {
      expect((await t.app.inject({ method: 'GET', url: '/v1/games' })).statusCode).toBe(200);
    }
  });
});
