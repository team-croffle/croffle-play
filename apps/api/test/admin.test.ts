import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { games, sdkVersions } from '../src/db/schema.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

const origin = (id: string) => `https://${id}.play.test`;
const manifest = (id: string, sdk = '^1.0.0') => ({
  id,
  name: 'From game.json',
  sdk,
  entry: 'play.html',
  thumbnail: 'thumb.png',
});

describe('admin game registry', () => {
  let t: TestApp;
  const manifests: Record<string, unknown> = {
    [`${origin('online')}/game.json`]: manifest('online'),
    [`${origin('wrong-id')}/game.json`]: manifest('someone-else'),
    [`${origin('broken')}/game.json`]: { id: 'broken' },
  };

  beforeAll(async () => {
    t = await createTestApp({
      seed: true,
      env: { GAME_ORIGIN_TEMPLATE: 'https://{id}.play.test' },
      manifests,
    });
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

  it('reads game.json at registration when the game is online', async () => {
    const res = await call('POST', '/v1/admin/games', { id: 'online', name: 'Online' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      listed: false,
      sdkMajor: 1,
      manifest: { entry: 'play.html' },
      manifestError: null,
    });
  });

  it('registers offline games unlisted and records why game.json is missing', async () => {
    const res = await call('POST', '/v1/admin/games', { id: 'offline', name: 'Offline' });
    expect(res.json()).toMatchObject({
      listed: false,
      manifest: null,
      manifestError: expect.stringContaining('https://offline.play.test/game.json'),
    });
    const list = await call('PATCH', '/v1/admin/games/offline', { listed: true });
    expect(list.statusCode).toBe(422);
    expect(list.json<{ message: string }>().message).toMatch(/no game.json yet/);
  });

  it('refuses a game.json with another id or an invalid shape', async () => {
    await call('POST', '/v1/admin/games', { id: 'wrong-id', name: 'Wrong' });
    const wrong = await call('POST', '/v1/admin/games/wrong-id/refresh');
    expect(wrong.statusCode).toBe(422);
    expect(wrong.json<{ message: string }>().message).toMatch(/says id 'someone-else'/);
    await call('POST', '/v1/admin/games', { id: 'broken', name: 'Broken' });
    const broken = await call('POST', '/v1/admin/games/broken/refresh');
    expect(broken.json<{ message: string }>().message).toMatch(/game.json is invalid/);
  });

  it('lists a game once game.json is valid', async () => {
    const res = await call('PATCH', '/v1/admin/games/online', { listed: true });
    expect(res.statusCode).toBe(200);
    const catalog = await t.app.inject({ method: 'GET', url: '/v1/games/online' });
    expect(catalog.json()).toMatchObject({
      id: 'online',
      thumbnailUrl: 'https://online.play.test/thumb.png',
    });
  });

  it('refuses refreshing onto an old SDK major and keeps the last good game.json', async () => {
    await t.db.insert(sdkVersions).values({ major: 2, status: 'old' });
    manifests[`${origin('online')}/game.json`] = manifest('online', '^2.0.0');
    const res = await call('POST', '/v1/admin/games/online/refresh');
    expect(res.statusCode).toBe(422);
    expect(res.json<{ message: string }>().message).toMatch(/SDK v2 is old.*Migration guide/);
    const [row] = await t.db.select().from(games).where(eq(games.id, 'online'));
    expect(row).toMatchObject({ sdkMajor: 1, listed: true });
    expect(row?.manifestError).toMatch(/SDK v2 is old/);
  });

  it('refuses listing on an old major but leaves listed games alone', async () => {
    await t.db.update(sdkVersions).set({ status: 'old' }).where(eq(sdkVersions.major, 1));
    expect((await call('PATCH', '/v1/admin/games/new-game', { listed: true })).statusCode).toBe(
      422,
    );
    expect((await t.app.inject({ method: 'GET', url: '/v1/games/online' })).statusCode).toBe(200);
    await t.db.update(sdkVersions).set({ status: 'current' }).where(eq(sdkVersions.major, 1));
  });

  it('serves play info for unlisted games to admins only', async () => {
    expect((await call('GET', '/v1/admin/games/offline/play')).json()).toEqual({
      id: 'offline',
      name: 'Offline',
      url: 'https://offline.play.test/',
    });
    expect((await t.app.inject({ method: 'GET', url: '/v1/games/offline/play' })).statusCode).toBe(
      404,
    );
  });

  it('no longer has versions, approvals, or bundle limits', async () => {
    expect(
      (await call('POST', '/v1/admin/games/online/rollback', { version: '1' })).statusCode,
    ).toBe(404);
    expect(
      (await call('PATCH', '/v1/admin/games/online', { maxBundleBytes: 1 })).json(),
    ).not.toHaveProperty('maxBundleBytes');
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
