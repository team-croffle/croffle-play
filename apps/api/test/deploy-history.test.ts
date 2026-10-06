import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { gameDeploys, games, sdkVersions } from '../src/db/schema.js';
import { buildZip, gameBuild } from './support/build-zip.js';
import { FakeStorage } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';

interface Deploy {
  id: string;
  active: boolean;
  version: string | null;
}

describe('platform hosting: deploy history, rollback, pruning, hosting switch', () => {
  let t: TestApp;
  const storage = new FakeStorage();

  beforeAll(async () => {
    t = await createTestApp({
      seed: true,
      storage,
      env: { DEPLOY_KEEP: '3', GAME_ORIGIN_TEMPLATE: 'https://{id}.play.test' },
      manifests: {
        'https://sample.play.test/game.json': { id: 'sample', name: 'S', sdk: '^1.0.0' },
      },
    });
  });

  afterAll(async () => {
    await t.close();
  });

  const upload = async (id: string, version: string) =>
    (
      await t.app.inject({
        method: 'POST',
        url: `/v1/admin/games/${id}/deploys`,
        headers: { ...t.adminAuth, 'content-type': 'application/zip' },
        payload: Buffer.from(await buildZip(gameBuild(id, [], { version }))),
      })
    ).json<Deploy>();
  const list = async (id: string) =>
    (
      await t.app.inject({
        method: 'GET',
        url: `/v1/admin/games/${id}/deploys`,
        headers: t.adminAuth,
      })
    ).json<{ items: Deploy[] }>().items;
  const call = (method: 'POST' | 'PATCH', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: t.adminAuth, ...(payload ? { payload } : {}) });
  const pointer = async (id: string) =>
    JSON.parse(new TextDecoder().decode((await storage.get(`games/${id}/current.json`))?.body))
      .deployId as string;

  it('lists deploys newest first with the active one marked, and rolls back', async () => {
    const d1 = await upload('sample', '1.0.0');
    const d2 = await upload('sample', '1.1.0');
    expect((await list('sample')).map((d) => [d.version, d.active])).toEqual([
      ['1.1.0', true],
      ['1.0.0', false],
    ]);

    const back = await call('POST', `/v1/admin/games/sample/deploys/${d1.id}/activate`);
    expect(back.statusCode, back.body).toBe(200);
    expect(back.json<Deploy>()).toMatchObject({ id: d1.id, active: true });
    expect(await pointer('sample')).toBe(d1.id);
    const [game] = await t.db.select().from(games).where(eq(games.id, 'sample'));
    expect(game?.activeDeployId).toBe(d1.id);
    expect(game?.manifest?.version).toBe('1.0.0');
    expect((await list('sample')).find((d) => d.id === d2.id)?.active).toBe(false);

    const unknown = await call(
      'POST',
      '/v1/admin/games/sample/deploys/00000000-0000-4000-8000-000000000000/activate',
    );
    expect(unknown.statusCode).toBe(404);
  });

  it('keeps DEPLOY_KEEP uploads, never dropping the active one', async () => {
    // Active is d1 (rolled back above). Three more uploads: the newest is active, d1 is the
    // oldest non-active one at the moment it stops being active.
    const d3 = await upload('sample', '1.2.0');
    const d4 = await upload('sample', '1.3.0');
    const d5 = await upload('sample', '1.4.0');
    const versions = (await list('sample')).map((d) => d.version);
    expect(versions).toEqual(['1.4.0', '1.3.0', '1.2.0']);
    expect(await storage.list(`games/sample/${d3.id}/`)).not.toEqual([]);
    expect(await pointer('sample')).toBe(d5.id);
    expect((await list('sample')).find((d) => d.id === d4.id)?.active).toBe(false);
    // Files of the pruned deploys are gone.
    const kept = new Set([d3.id, d4.id, d5.id]);
    const stray = (await storage.list('games/sample/')).filter(
      (o) => !o.key.endsWith('current.json') && !kept.has(o.key.split('/')[2] ?? ''),
    );
    expect(stray).toEqual([]);
  });

  it('refuses refreshing game.json from the origin while the platform hosts the game', async () => {
    const res = await call('POST', '/v1/admin/games/sample/refresh');
    expect(res.statusCode).toBe(409);
  });

  it('switches hosting back to the team and to the platform again', async () => {
    const toTeam = await call('PATCH', '/v1/admin/games/sample', { hosting: 'team' });
    expect(toTeam.statusCode, toTeam.body).toBe(200);
    expect(toTeam.json<{ hosting: string; activeDeployId: string | null }>()).toMatchObject({
      hosting: 'team',
      activeDeployId: null,
    });
    expect(await storage.get('games/sample/current.json')).toBeNull();
    expect((await call('POST', '/v1/admin/games/sample/refresh')).statusCode).toBe(200);
    expect((await list('sample')).length).toBe(3); // uploads stay for a later switch

    const toPlatform = await call('PATCH', '/v1/admin/games/sample', { hosting: 'platform' });
    expect(toPlatform.statusCode, toPlatform.body).toBe(200);
    const newest = (await list('sample'))[0];
    expect(newest?.active).toBe(true);
    expect(await pointer('sample')).toBe(newest?.id);

    const noBuild = await call('PATCH', '/v1/admin/games/duo', { hosting: 'platform' });
    expect(noBuild.statusCode).toBe(409);
  });

  it('refuses a rollback onto an SDK major that no longer registers', async () => {
    const d = await upload('sample', '2.0.0');
    await t.db.update(sdkVersions).set({ status: 'old' }).where(eq(sdkVersions.major, 1));
    try {
      const res = await call('POST', `/v1/admin/games/sample/deploys/${d.id}/activate`);
      expect(res.statusCode).toBe(422);
    } finally {
      await t.db.update(sdkVersions).set({ status: 'current' }).where(eq(sdkVersions.major, 1));
    }
    const rows = await t.db.select().from(gameDeploys).where(eq(gameDeploys.gameId, 'sample'));
    expect(rows.length).toBe(3);
  });
});
