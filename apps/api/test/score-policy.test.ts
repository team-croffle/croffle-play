import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DeployKeysService } from '../src/deploy-keys/deploy-keys.service.js';
import { UsersService } from '../src/users/users.service.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('score trust policy', () => {
  let t: TestApp;
  let serverKey: string;
  let deployKey: string;
  let aliceId: string;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    const keys = t.app.get(DeployKeysService);
    serverKey = (await keys.issue('block-drop', 'server', 'server')).key;
    deployKey = (await keys.issue('block-drop')).key;
    aliceId = (await t.app.get(UsersService).ensure('idp|alice')).id;
  });

  afterAll(async () => {
    await t.close();
  });

  const fromBrowser = async (score: number, game = 'block-drop') =>
    t.app.inject({
      method: 'POST',
      url: `/v1/games/${game}/scores`,
      headers: await bearerFor('idp|alice'),
      payload: { score },
    });
  const fromServer = (score: number, key = serverKey, userId = aliceId) =>
    t.app.inject({
      method: 'POST',
      url: '/v1/games/block-drop/scores/verified',
      headers: { authorization: `Bearer ${key}` },
      payload: { userId, score },
    });
  const board = async () =>
    (await t.app.inject({ method: 'GET', url: '/v1/games/block-drop/leaderboard' })).json<{
      policy: string;
      items: { score: number; verified: boolean }[];
    }>();

  it('issues server keys with their own prefix; deploy keys cannot submit scores', async () => {
    expect(serverKey).toMatch(/^csk_block-drop_/);
    expect((await fromServer(1, deployKey)).statusCode).toBe(401);
    expect((await fromServer(1, 'csk_nope')).statusCode).toBe(401);
    const publish = await t.app.inject({
      method: 'POST',
      url: '/v1/games/block-drop/versions',
      headers: { authorization: `Bearer ${serverKey}` },
      payload: {},
    });
    expect(publish.statusCode).toBe(401);
  });

  it('client policy: browser scores count and are marked unverified', async () => {
    expect((await fromBrowser(50)).json()).toEqual({ accepted: true, best: 50 });
    expect(await board()).toMatchObject({
      policy: 'client',
      items: [{ score: 50, verified: false }],
    });
  });

  it('server policy: only server-submitted scores count', async () => {
    const patch = await t.app.inject({
      method: 'PATCH',
      url: '/v1/admin/games/block-drop',
      headers: t.adminAuth,
      payload: { scorePolicy: 'server', scoreMin: 0, scoreMax: 1000 },
    });
    expect(patch.statusCode).toBe(200);
    expect(await board()).toMatchObject({ policy: 'server', items: [] });
    expect((await fromBrowser(999)).json()).toEqual({ accepted: false, best: null });
    expect((await fromServer(70)).json()).toEqual({ accepted: true, best: 70 });
    expect(await board()).toMatchObject({ items: [{ score: 70, verified: true }] });
  });

  it('refuses scores outside the game range and unknown players', async () => {
    expect((await fromServer(5000)).statusCode).toBe(422);
    expect((await fromServer(-1)).statusCode).toBe(422);
    expect(
      (await fromServer(1, serverKey, '00000000-0000-4000-8000-000000000000')).statusCode,
    ).toBe(404);
  });
});
