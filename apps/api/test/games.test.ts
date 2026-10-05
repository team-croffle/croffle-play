import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { games } from '../src/db/schema.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('/v1/games', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    // Registered but not listed: must stay hidden.
    await t.db.insert(games).values({ id: 'unreleased', name: 'Unreleased' });
  });

  afterAll(async () => {
    await t.close();
  });

  it('lists only listed games, by name', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/v1/games' });
    expect(res.statusCode).toBe(200);
    const ids = res.json<{ items: { id: string }[] }>().items.map((g) => g.id);
    expect(ids).toEqual(['block-drop', 'duo', 'sample', 'word-chain']);
  });

  it('returns one game', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/v1/games/block-drop' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: 'block-drop',
      name: 'Block Drop',
      description: 'Falling blocks.',
      thumbnailUrl: null,
      serverProtocol: null,
      sdk: { major: 1, status: 'current', oldAt: null, deprecatedAt: null },
    });
  });

  it('404s for unknown and unreleased games', async () => {
    for (const id of ['nope', 'unreleased']) {
      const res = await t.app.inject({ method: 'GET', url: `/v1/games/${id}` });
      expect(res.statusCode).toBe(404);
    }
  });

  it('keeps probes outside the version prefix', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    expect((await t.app.inject({ method: 'GET', url: '/v1/healthz' })).statusCode).toBe(404);
  });
});

describe('/v1/games/:id/server', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    const [g] = await t.db.select().from(games).where(eq(games.id, 'block-drop'));
    await t.db
      .update(games)
      .set({
        manifest: { ...g!.manifest!, server: { url: 'wss://rt.example/ws', protocol: '1.2.0' } },
      })
      .where(eq(games.id, 'block-drop'));
  });

  afterAll(async () => {
    await t.close();
  });

  it('returns the server game.json declares, and 404 without one', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/v1/games/block-drop/server' });
    expect(res.json()).toEqual({ url: 'wss://rt.example/ws', protocol: '1.2.0' });
    expect((await t.app.inject({ method: 'GET', url: '/v1/games/sample/server' })).statusCode).toBe(
      404,
    );
    expect(
      (await t.app.inject({ method: 'GET', url: '/v1/games/block-drop' })).json(),
    ).toMatchObject({ serverProtocol: '1.2.0' });
  });
});
