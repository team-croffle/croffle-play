import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { gameVersions, games } from '../src/db/schema.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('admin games', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    await t.db
      .insert(games)
      .values({ id: 'rel', name: 'Rel', stableVersion: '1.0.0', previewVersion: '1.2.0' });
    await t.db.insert(gameVersions).values([
      { gameId: 'rel', version: '1.0.0', status: 'approved', manifest: {} },
      { gameId: 'rel', version: '1.1.0', status: 'uploaded', manifest: {} },
      { gameId: 'rel', version: '1.2.0', status: 'uploaded', manifest: {} },
      { gameId: 'rel', version: '1.3.0', status: 'pending', manifest: {} },
    ]);
  });

  afterAll(async () => {
    await t.close();
  });

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: t.adminAuth, ...(payload ? { payload } : {}) });

  it('requires a signed-in admin', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/v1/admin/games' })).statusCode).toBe(401);
  });

  it('creates games with valid, unreserved ids only', async () => {
    expect(
      (await call('POST', '/v1/admin/games', { id: 'new-game', name: 'New' })).statusCode,
    ).toBe(201);
    expect(
      (await call('POST', '/v1/admin/games', { id: 'new-game', name: 'Again' })).statusCode,
    ).toBe(409);
    expect(
      (await call('POST', '/v1/admin/games', { id: 'api', name: 'Reserved' })).statusCode,
    ).toBe(400);
    expect((await call('POST', '/v1/admin/games', { id: 'Bad_Id', name: 'Bad' })).statusCode).toBe(
      400,
    );
  });

  it('approves a version: status approved, stable pointer moves', async () => {
    const res = await call('POST', '/v1/admin/games/rel/versions/1.1.0/approve');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ stableVersion: '1.1.0' });
    expect((await call('POST', '/v1/admin/games/rel/versions/1.3.0/approve')).statusCode).toBe(409);
  });

  it('rolls back to an earlier approved version only', async () => {
    expect(
      (await call('POST', '/v1/admin/games/rel/rollback', { version: '1.0.0' })).json(),
    ).toMatchObject({
      stableVersion: '1.0.0',
    });
    expect(
      (await call('POST', '/v1/admin/games/rel/rollback', { version: '1.2.0' })).statusCode,
    ).toBe(409);
  });

  it('rejects an uploaded version and clears the preview pointer', async () => {
    const res = await call('POST', '/v1/admin/games/rel/versions/1.2.0/reject');
    expect(res.json()).toMatchObject({ previewVersion: null, stableVersion: '1.0.0' });
    const detail = (await call('GET', '/v1/admin/games/rel')).json<{
      versions: { version: string; status: string }[];
    }>();
    expect(detail.versions.find((v) => v.version === '1.2.0')?.status).toBe('rejected');
  });

  it('serves play info for any uploaded version to admins only', async () => {
    expect((await call('GET', '/v1/admin/games/rel/versions/1.1.0/play')).json()).toMatchObject({
      version: '1.1.0',
    });
    expect((await call('GET', '/v1/admin/games/rel/versions/1.3.0/play')).statusCode).toBe(404);
    expect(
      (await t.app.inject({ method: 'GET', url: '/v1/games/rel/play?version=1.1.0' })).statusCode,
    ).toBe(404);
  });

  it('raises the bundle limit within bounds', async () => {
    expect(
      (await call('PATCH', '/v1/admin/games/rel', { maxBundleBytes: 100 * 1024 * 1024 })).json(),
    ).toMatchObject({
      maxBundleBytes: 104857600,
    });
    expect(
      (await call('PATCH', '/v1/admin/games/rel', { maxBundleBytes: 500 * 1024 * 1024 }))
        .statusCode,
    ).toBe(400);
  });
});

describe('admin role', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('refuses signed-in players without the admin role', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: '/v1/admin/games',
      headers: await bearerFor('idp|player'),
    });
    expect(res.statusCode).toBe(403);
    expect(
      (await t.app.inject({ method: 'GET', url: '/v1/admin/games', headers: t.adminAuth }))
        .statusCode,
    ).toBe(200);
  });
});
