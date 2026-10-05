import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { games, sdkVersions } from '../src/db/schema.js';
import { UsersService } from '../src/users/users.service.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('game members and the developer dashboard', () => {
  let t: TestApp;
  let devId: string;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    const dev = await t.app.get(UsersService).ensure('idp|dev');
    devId = dev.id;
    await t.app.get(UsersService).updateProfile(dev.id, { nickname: 'dev_50%', avatar: null });
  });

  afterAll(async () => {
    await t.close();
  });

  const admin = (method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: t.adminAuth, ...(payload ? { payload } : {}) });
  const myGames = async () =>
    (
      await t.app.inject({
        method: 'GET',
        url: '/v1/me/games',
        headers: await bearerFor('idp|dev'),
      })
    ).json<{
      items: { id: string; role: string; warnings: string[]; sdk: { status: string } }[];
    }>().items;

  it('finds accounts by nickname with LIKE wildcards taken literally', async () => {
    const hits = (await admin('GET', '/v1/admin/users?q=50%25')).json<{ items: { id: string }[] }>()
      .items;
    expect(hits.map((u) => u.id)).toEqual([devId]);
    expect(
      (await admin('GET', '/v1/admin/users?q=%25')).json<{ items: unknown[] }>().items,
    ).toHaveLength(1);
    expect((await admin('GET', '/v1/admin/users?q=')).statusCode).toBe(400);
  });

  it('adds members, and members see their games with warnings', async () => {
    expect(await myGames()).toEqual([]);
    expect(
      (await admin('PUT', `/v1/admin/games/block-drop/members/${devId}`, { role: 'owner' }))
        .statusCode,
    ).toBe(204);
    expect((await admin('GET', '/v1/admin/games/block-drop/members')).json()).toMatchObject({
      items: [{ user: { id: devId, nickname: 'dev_50%' }, role: 'owner' }],
    });
    expect(await myGames()).toMatchObject([
      { id: 'block-drop', role: 'owner', warnings: [], sdk: { status: 'current' } },
    ]);

    await t.db
      .update(sdkVersions)
      .set({ status: 'old', deprecatedAt: new Date('2099-06-01T00:00:00Z') })
      .where(eq(sdkVersions.major, 1));
    await t.db
      .update(games)
      .set({ manifestError: 'https://block-drop.localhost:4100/game.json answered 404' })
      .where(eq(games.id, 'block-drop'));
    const [mine] = await myGames();
    expect(mine?.warnings).toEqual([
      'SDK v1 is old (deprecated from 2099-06-01): updates are refused until you upgrade with `npx @croffledev/play-sdk migrate`',
      'game.json could not be read: https://block-drop.localhost:4100/game.json answered 404',
    ]);
  });

  it('removes members and validates input', async () => {
    expect(
      (await admin('PUT', `/v1/admin/games/block-drop/members/${devId}`, { role: 'boss' }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await admin(
          'PUT',
          '/v1/admin/games/block-drop/members/00000000-0000-4000-8000-000000000000',
          { role: 'developer' },
        )
      ).statusCode,
    ).toBe(404);
    expect((await admin('DELETE', `/v1/admin/games/block-drop/members/${devId}`)).statusCode).toBe(
      204,
    );
    expect(await myGames()).toEqual([]);
  });
});
