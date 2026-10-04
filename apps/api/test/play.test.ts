import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { gameVersions, games, sdkVersions } from '../src/db/schema.js';
import { registerAdapter } from '../src/sdk/register-adapter.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('play info and SDK registry', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({
      seed: true,
      env: { GAME_URL_TEMPLATE: 'https://{id}.games.test/{version}/' },
    });
    await t.db
      .update(games)
      .set({ previewVersion: '1.3.0-rc.1' })
      .where(eq(games.id, 'block-drop'));
    await t.db.insert(gameVersions).values([
      {
        gameId: 'block-drop',
        version: '1.3.0-rc.1',
        manifest: { entry: 'play.html' },
        sdkMajor: 2,
        status: 'uploaded',
      },
      { gameId: 'block-drop', version: '0.9.0', manifest: {}, status: 'approved' },
    ]);
  });

  afterAll(async () => {
    await t.close();
  });

  const get = (url: string) => t.app.inject({ method: 'GET', url });

  it('serves the stable version with its SDK', async () => {
    await registerAdapter(
      t.db,
      { major: 1, version: '1.0.0', file: 'index.js', integrity: 'sha384-abc' },
      'https://cdn.test/adapters/v1/1.0.0/manifest.json',
    );
    const res = await get('/v1/games/sample/play');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: 'sample',
      name: 'Sample',
      version: '1.0.0',
      url: 'https://sample.games.test/1.0.0/index.html',
      sdkMajor: 1,
      sdk: expect.objectContaining({
        major: 1,
        status: 'current',
        adapterUrl: 'https://cdn.test/adapters/v1/1.0.0/index.js',
        sri: 'sha384-abc',
      }),
    });
  });

  it('serves the preview version on request, with an unregistered SDK as null', async () => {
    const res = await get('/v1/games/block-drop/play?version=1.3.0-rc.1');
    expect(res.json()).toMatchObject({
      version: '1.3.0-rc.1',
      url: 'https://block-drop.games.test/1.3.0-rc.1/play.html',
      sdkMajor: 2,
      sdk: null,
    });
  });

  it('refuses versions other than stable and preview', async () => {
    expect((await get('/v1/games/block-drop/play?version=0.9.0')).statusCode).toBe(404);
    expect((await get('/v1/games/nope/play')).statusCode).toBe(404);
  });

  it('describes SDK majors', async () => {
    await t.db.update(sdkVersions).set({ status: 'lts' }).where(eq(sdkVersions.major, 1));
    expect((await get('/v1/sdk/1')).json()).toMatchObject({ major: 1, status: 'lts' });
    expect((await get('/v1/sdk/9')).statusCode).toBe(404);
    expect((await get('/v1/sdk/x')).statusCode).toBe(400);
  });

  it('re-registering an adapter keeps the lifecycle status', async () => {
    await registerAdapter(
      t.db,
      { major: 1, version: '1.0.1', file: 'index.js', integrity: 'sha384-def' },
      'https://cdn.test/adapters/v1/1.0.1/manifest.json',
    );
    expect((await get('/v1/sdk/1')).json()).toMatchObject({ status: 'lts', sri: 'sha384-def' });
  });
});
