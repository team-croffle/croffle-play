import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sdkAdapterVersions, sdkAdminEvents } from '../src/db/schema-sdk.js';
import { publish, type Published, REGISTRY, registry } from './support/fake-registry.js';
import { FakeStorage } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';

interface Detail {
  adapterUrl: string | null;
  adapters: { version: string; source: string; active: boolean }[];
  available: { version: string; compatible: boolean; installed: boolean }[] | null;
  availableError: string | null;
  sync: { intervalSeconds: number; lastRunAt: string | null };
  events: { kind: string; actor: string | null }[];
}

describe('admin SDK API: adapters from npm', () => {
  let t: TestApp;
  const storage = new FakeStorage();
  const released: Published[] = [];

  beforeAll(async () => {
    released.push(
      await publish('1.0.3', '>=0.14.0-rc.1', 'export const v = "1.0.3";'),
      await publish('1.1.0', '>=0.14.0-rc.1', 'export const v = "1.1.0";'),
      await publish('1.2.0', '>=0.15.0', 'export const v = "1.2.0";'),
    );
    t = await createTestApp({
      seed: true,
      storage,
      env: { APP_VERSION: '0.14.0-rc.1', NPM_REGISTRY_URL: REGISTRY },
      registryFetch: registry(released),
    });
  });

  afterAll(async () => {
    await t.close();
  });

  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: t.adminAuth, ...(payload ? { payload } : {}) });
  const detail = async () => (await call('GET', '/v1/admin/sdk/1')).json<Detail>();

  it('shows what npm offers, with compatibility, and the sync state', async () => {
    const d = await detail();
    expect(d.available?.map((a) => [a.version, a.compatible, a.installed])).toEqual([
      ['1.2.0', false, false],
      ['1.1.0', true, false],
      ['1.0.3', true, false],
    ]);
    expect(d.availableError).toBeNull();
    expect(d.sync.intervalSeconds).toBe(0);
  });

  it('installs a release on request and records the admin', async () => {
    const res = await call('POST', '/v1/admin/sdk/1/adapters', { version: '1.0.3' });
    expect(res.statusCode, res.body).toBe(200);
    const d = res.json<Detail>();
    expect(d.adapterUrl).toBe('/adapters/v1/1.0.3/index.js');
    expect(d.adapters).toMatchObject([{ version: '1.0.3', source: 'npm', active: true }]);
    expect(d.events[0]).toMatchObject({ kind: 'adapter_activated' });
    expect(d.events[0]?.actor).not.toBeNull();
    const bad = await call('POST', '/v1/admin/sdk/1/adapters', { version: '1.2.0' });
    expect(bad.statusCode).toBe(422);
  });

  it('runs a sync now and moves to the newest compatible release', async () => {
    const res = await call('POST', '/v1/admin/sdk/sync');
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<{ results: { major: number; installed: string | null }[] }>().results).toEqual([
      { major: 1, installed: '1.1.0' },
    ]);
    const d = await detail();
    expect(d.adapterUrl).toBe('/adapters/v1/1.1.0/index.js');
    expect(d.sync.lastRunAt).not.toBeNull();
  });

  it('removes an inactive version (files and record), never the active one', async () => {
    expect((await call('DELETE', '/v1/admin/sdk/1/adapters/1.1.0')).statusCode).toBe(409);
    const res = await call('DELETE', '/v1/admin/sdk/1/adapters/1.0.3');
    expect(res.statusCode, res.body).toBe(200);
    expect(await storage.get('adapters/v1/1.0.3/index.js')).toBeNull();
    const rows = await t.db
      .select()
      .from(sdkAdapterVersions)
      .where(eq(sdkAdapterVersions.major, 1));
    expect(rows.map((r) => r.version)).toEqual(['1.1.0']);
    const events = await t.db.select().from(sdkAdminEvents).where(eq(sdkAdminEvents.major, 1));
    expect(events.some((e) => e.kind === 'adapter_removed')).toBe(true);
    expect((await call('DELETE', '/v1/admin/sdk/1/adapters/9.9.9')).statusCode).toBe(404);
  });

  it('reports a registry failure instead of failing the page', async () => {
    const broken = await createTestApp({
      seed: true,
      storage: new FakeStorage(),
      env: { NPM_REGISTRY_URL: REGISTRY },
      registryFetch: (async () => new Response('down', { status: 503 })) as typeof fetch,
    });
    try {
      const res = await broken.app.inject({
        method: 'GET',
        url: '/v1/admin/sdk/1',
        headers: broken.adminAuth,
      });
      expect(res.statusCode).toBe(200);
      const d = res.json<Detail>();
      expect(d.available).toBeNull();
      expect(d.availableError).toMatch(/503/);
    } finally {
      await broken.close();
    }
  });
});
