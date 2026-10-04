import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('scores and leaderboard', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
  });

  afterAll(async () => {
    await t.close();
  });

  const submit = async (sub: string, score: unknown, game = 'sample') =>
    t.app.inject({
      method: 'POST',
      url: `/v1/games/${game}/scores`,
      headers: await bearerFor(sub),
      payload: { score },
    });

  it('requires sign-in', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/games/sample/scores',
      payload: { score: 1 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('records scores and reports the best', async () => {
    expect((await submit('a', 100)).json()).toEqual({ accepted: true, best: 100 });
    expect((await submit('a', 50)).json()).toEqual({ accepted: true, best: 100 });
    expect((await submit('a', 'x')).statusCode).toBe(400);
    expect((await submit('a', 1, 'nope')).statusCode).toBe(404);
  });

  it('ranks each player once by their best score', async () => {
    await submit('b', 300);
    await submit('c', 200);
    await submit('b', 10);
    const res = await t.app.inject({ method: 'GET', url: '/v1/games/sample/leaderboard?limit=2' });
    const items = res.json<{
      items: { rank: number; score: number; user: { nickname: string } }[];
    }>().items;
    expect(items.map((e) => [e.rank, e.score])).toEqual([
      [1, 300],
      [2, 200],
    ]);
    expect(JSON.stringify(items)).not.toMatch(/"sub"/);
    expect(
      (await t.app.inject({ method: 'GET', url: '/v1/games/sample/leaderboard?limit=1000' }))
        .statusCode,
    ).toBe(400);
  });

  it('keeps leaderboards per game', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/v1/games/block-drop/leaderboard' });
    expect(res.json()).toEqual({ items: [] });
  });
});

describe('saves', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
  });

  afterAll(async () => {
    await t.close();
  });

  const call = async (sub: string, method: 'GET' | 'PUT', slot: string, data?: string) =>
    t.app.inject({
      method,
      url: `/v1/games/sample/saves/${slot}`,
      headers: await bearerFor(sub),
      ...(data === undefined ? {} : { payload: { data } }),
    });

  it('stores slots per player', async () => {
    expect((await call('p1', 'GET', 'main')).json()).toEqual({ data: null });
    expect((await call('p1', 'PUT', 'main', '{"lvl":3}')).statusCode).toBe(204);
    expect((await call('p1', 'PUT', 'main', '{"lvl":4}')).statusCode).toBe(204);
    expect((await call('p1', 'GET', 'main')).json()).toEqual({ data: '{"lvl":4}' });
    expect((await call('p2', 'GET', 'main')).json()).toEqual({ data: null });
  });

  it('validates slots and size', async () => {
    expect((await call('p1', 'GET', 'Bad Slot')).statusCode).toBe(400);
    expect((await call('p1', 'PUT', 'big', 'x'.repeat(256 * 1024 + 1))).statusCode).toBe(413);
  });

  it('requires sign-in', async () => {
    expect(
      (await t.app.inject({ method: 'GET', url: '/v1/games/sample/saves/main' })).statusCode,
    ).toBe(401);
  });
});
