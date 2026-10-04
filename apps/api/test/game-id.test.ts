import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminAuth, createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('game id route parameters', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
  });

  afterAll(async () => {
    await t.close();
  });

  it.each([
    ['GET', '/v1/games/API'],
    ['GET', '/v1/games/www/play'],
    ['GET', '/v1/games/srv'],
    ['GET', '/v1/admin/games/api'],
    ['POST', '/v1/admin/games/static/deploy-keys'],
  ] as const)('%s %s → 404', async (method, url) => {
    const res = await t.app.inject({ method, url, headers: adminAuth, payload: {} });
    expect(res.statusCode).toBe(404);
  });

  it('404s a valid score for an invalid id', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/games/Bad_Id/scores',
      headers: await bearerFor('someone'),
      payload: { score: 1 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('authenticates publish before looking at the id', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/games/admin/versions',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });
});
