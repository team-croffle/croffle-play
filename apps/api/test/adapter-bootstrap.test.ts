import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sdkAdapterVersions, sdkAdminEvents } from '../src/db/schema-sdk.js';
import { sdkVersions } from '../src/db/schema.js';
import { AdapterBootstrapService } from '../src/sdk/adapter-bootstrap.service.js';
import { registerAdapter } from '../src/sdk/register-adapter.js';
import { FakeStorage } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** An image's adapter directory: v<N>/<version>/{index.js,manifest.json}. */
async function imageDir(bundles: { major: number; version: string; code: string }[]) {
  const root = await mkdtemp(join(tmpdir(), 'adapters-'));
  for (const b of bundles) {
    const dir = join(root, `v${b.major}`, b.version);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.js'), b.code);
    const integrity = `sha384-${createHash('sha384').update(b.code).digest('base64')}`;
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({ major: b.major, version: b.version, file: 'index.js', integrity }),
    );
  }
  return root;
}

describe('adapter bundles shipped in the api image', () => {
  let dir: string;
  let t: TestApp;
  const storage = new FakeStorage();

  beforeAll(async () => {
    dir = await imageDir([
      { major: 1, version: '0.13.0', code: 'export const v = "0.13.0";' },
      { major: 1, version: 'dev', code: 'export const v = "dev";' },
    ]);
    t = await createTestApp({ seed: true, storage, env: { ADAPTER_BUNDLE_DIR: dir } });
  });

  afterAll(async () => {
    await t.close();
    await rm(dir, { recursive: true, force: true });
  });

  const active = async () =>
    (await t.db.select().from(sdkVersions).where(eq(sdkVersions.major, 1)))[0]?.adapterUrl;
  const events = () => t.db.select().from(sdkAdminEvents).where(eq(sdkAdminEvents.major, 1));

  it('registers the release bundle at boot and skips dev builds', async () => {
    expect(await active()).toBe('/adapters/v1/0.13.0/index.js');
    expect(await storage.get('adapters/v1/0.13.0/index.js')).not.toBeNull();
    const versions = await t.db.select().from(sdkAdapterVersions);
    expect(versions.map((x) => [x.version, x.source])).toEqual([['0.13.0', 'image']]);
    const recorded = await events();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      kind: 'adapter_activated',
      actor: null,
      to: { version: '0.13.0', source: 'image' },
    });
  });

  it('does nothing when the active adapter is already the image version', async () => {
    expect(await t.app.get(AdapterBootstrapService).register(dir)).toBe(0);
    expect(await events()).toHaveLength(1);
  });

  it('keeps the version an admin picked (the image bundle is only the first adapter)', async () => {
    const other = 'export const v = "0.12.0";';
    await registerAdapter(
      t.db,
      {
        major: 1,
        version: '0.12.0',
        file: 'index.js',
        integrity: `sha384-${createHash('sha384').update(other).digest('base64')}`,
      },
      '/adapters/v1/0.12.0/index.js',
      'cli',
      null,
    );
    expect(await active()).toBe('/adapters/v1/0.12.0/index.js');
    expect(await t.app.get(AdapterBootstrapService).register(dir)).toBe(0);
    expect(await active()).toBe('/adapters/v1/0.12.0/index.js');
    expect(await events()).toHaveLength(2);
  });

  it('is skipped when disabled or when the directory is missing', async () => {
    const off = await createTestApp({
      seed: true,
      storage: new FakeStorage(),
      env: { ADAPTER_BUNDLE_DIR: dir, ADAPTER_AUTO_REGISTER: 'false' },
    });
    try {
      const [row] = await off.db.select().from(sdkVersions).where(eq(sdkVersions.major, 1));
      expect(row?.adapterUrl).toBeNull();
    } finally {
      await off.close();
    }
    const missing = await createTestApp({
      seed: true,
      storage: new FakeStorage(),
      env: { ADAPTER_BUNDLE_DIR: join(dir, 'nope') },
    });
    try {
      const [row] = await missing.db.select().from(sdkVersions).where(eq(sdkVersions.major, 1));
      expect(row?.adapterUrl).toBeNull();
    } finally {
      await missing.close();
    }
  });
});
