import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { games } from '../src/db/schema.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('/v1/games', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    // Uploaded but never approved: must stay hidden.
    await t.db
      .insert(games)
      .values({ id: 'unreleased', name: 'Unreleased', previewVersion: '0.1.0' });
  });

  afterAll(async () => {
    await t.close();
  });

  it('lists only games with a stable version, by name', async () => {
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
      version: '1.2.0',
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
