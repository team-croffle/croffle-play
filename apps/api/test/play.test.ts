import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { games, sdkVersions } from '../src/db/schema.js';
import { registerAdapter } from '../src/sdk/register-adapter.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('play info and SDK registry', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({
      seed: true,
      env: { GAME_ORIGIN_TEMPLATE: 'https://{id}.play.test' },
    });
    await t.db.insert(games).values({ id: 'hidden', name: 'Hidden' });
  });

  afterAll(async () => {
    await t.close();
  });

  const get = (url: string) => t.app.inject({ method: 'GET', url });

  it('frames the entry document on the game origin', async () => {
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
      url: 'https://sample.play.test/index.html',
    });
    expect((await get('/v1/sdk/1')).json()).toMatchObject({
      adapterUrl: 'https://cdn.test/adapters/v1/1.0.0/index.js',
      sri: 'sha384-abc',
    });
  });

  it('404s unknown and unlisted games', async () => {
    expect((await get('/v1/games/hidden/play')).statusCode).toBe(404);
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
