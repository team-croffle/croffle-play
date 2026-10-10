import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';
import { create as createTar } from 'tar';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sdkAdapterVersions, sdkAdminEvents } from '../src/db/schema-sdk.js';
import { sdkVersions } from '../src/db/schema.js';
import { AdapterInstallService } from '../src/sdk/adapter-install.service.js';
import { FakeStorage } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const REGISTRY = 'https://registry.test/';

interface Published {
  version: string;
  requiresApi: string;
  tgz: Uint8Array;
  integrity: string;
}

/** Builds `@croffledev/play-adapter-v1@<version>` the way `pnpm pack` would. */
async function publish(version: string, requiresApi: string, code: string): Promise<Published> {
  const root = await mkdtemp(join(tmpdir(), 'adapter-pkg-'));
  const dist = join(root, 'package', 'dist');
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, 'index.js'), code);
  const integrity = `sha384-${createHash('sha384').update(code).digest('base64')}`;
  await writeFile(
    join(dist, 'manifest.json'),
    JSON.stringify({ major: 1, version, file: 'index.js', integrity, requiresApi }),
  );
  await writeFile(join(root, 'package', 'package.json'), '{}');
  const file = join(root, 'pkg.tgz');
  await createTar({ gzip: true, cwd: root, file }, ['package']);
  const tgz = new Uint8Array(await readFile(file));
  await rm(root, { recursive: true, force: true });
  return {
    version,
    requiresApi,
    tgz,
    integrity: `sha512-${createHash('sha512').update(tgz).digest('base64')}`,
  };
}

/** A registry with one package: packument + tarballs. */
function registry(published: Published[], tamper = false): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url === `${REGISTRY}${encodeURIComponent('@croffledev/play-adapter-v1')}`) {
      const versions: Record<string, unknown> = {};
      for (const p of published) {
        versions[p.version] = {
          dist: { tarball: `${REGISTRY}tarballs/${p.version}.tgz`, integrity: p.integrity },
          croffle: { requiresApi: p.requiresApi },
        };
      }
      return new Response(JSON.stringify({ versions }), { status: 200 });
    }
    const m = /tarballs\/(.+)\.tgz$/.exec(url);
    const p = m && published.find((x) => x.version === m[1]);
    if (p) {
      const body = tamper ? new Uint8Array([...p.tgz, 0]) : p.tgz;
      return new Response(Buffer.from(body), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

describe('adapters from npm', () => {
  let t: TestApp;
  let svc: AdapterInstallService;
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
    svc = t.app.get(AdapterInstallService);
    await t.db.insert(sdkVersions).values({ major: 2, status: 'deprecated' });
  });

  afterAll(async () => {
    await t.close();
  });

  const active = async () =>
    (await t.db.select().from(sdkVersions).where(eq(sdkVersions.major, 1)))[0]?.adapterUrl;

  it('lists releases newest first with compatibility against APP_VERSION', async () => {
    const list = await svc.available(1);
    expect(list.map((r) => [r.version, r.compatible, r.installed])).toEqual([
      ['1.2.0', false, false],
      ['1.1.0', true, false],
      ['1.0.3', true, false],
    ]);
  });

  it('refuses an incompatible release and an unknown one', async () => {
    await expect(svc.install(1, '1.2.0', null)).rejects.toThrow(/needs api >=0.15.0/);
    await expect(svc.install(1, '9.9.9', null)).rejects.toThrow(/not on npm/);
    expect(await active()).toBeNull();
  });

  it('syncs the newest compatible release, then has nothing more to do', async () => {
    expect(await svc.sync()).toEqual([{ major: 1, installed: '1.1.0' }]); // major 2 deprecated: skipped
    expect(await active()).toBe('/adapters/v1/1.1.0/index.js');
    const stored = await storage.get('adapters/v1/1.1.0/index.js');
    expect(new TextDecoder().decode(stored?.body)).toContain('1.1.0');
    const rows = await t.db
      .select()
      .from(sdkAdapterVersions)
      .where(eq(sdkAdapterVersions.major, 1));
    expect(rows.map((r) => [r.version, r.source])).toEqual([['1.1.0', 'npm']]);
    const events = await t.db.select().from(sdkAdminEvents).where(eq(sdkAdminEvents.major, 1));
    expect(events).toHaveLength(1);
    expect(events[0]?.actor).toBeNull();

    expect(await svc.sync()).toEqual([{ major: 1, installed: null }]);
    expect((await svc.available(1)).find((r) => r.version === '1.1.0')?.installed).toBe(true);
  });

  it('installs an older release on request (rollback) and records the admin', async () => {
    const admin = (await t.db.query.users.findFirst())?.id ?? null;
    await svc.install(1, '1.0.3', admin);
    expect(await active()).toBe('/adapters/v1/1.0.3/index.js');
    // The sync moves back to the newest compatible one.
    expect(await svc.sync()).toEqual([{ major: 1, installed: '1.1.0' }]);
  });

  it('rejects a tarball that does not match the registry integrity', async () => {
    const tampered = await createTestApp({
      seed: true,
      storage: new FakeStorage(),
      env: { APP_VERSION: '0.14.0-rc.1', NPM_REGISTRY_URL: REGISTRY },
      registryFetch: registry(released, true),
    });
    try {
      await expect(
        tampered.app.get(AdapterInstallService).install(1, '1.1.0', null),
      ).rejects.toThrow(/integrity/);
      const [row] = await tampered.db.select().from(sdkVersions).where(eq(sdkVersions.major, 1));
      expect(row?.adapterUrl).toBeNull();
    } finally {
      await tampered.close();
    }
  });

  it('treats a dev api as compatible with everything', async () => {
    const dev = await createTestApp({
      seed: true,
      storage: new FakeStorage(),
      env: { NPM_REGISTRY_URL: REGISTRY },
      registryFetch: registry(released),
    });
    try {
      expect(
        (await dev.app.get(AdapterInstallService).available(1)).every((r) => r.compatible),
      ).toBe(true);
    } finally {
      await dev.close();
    }
  });
});
