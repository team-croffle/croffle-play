import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { publishAdapterDir } from '../src/sdk/register-adapter.js';
import { FakeStorage } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const code = 'export const major = 1; export function mount() {}';
const sri = `sha384-${createHash('sha384').update(code).digest('base64')}`;

async function adapterDir(manifest: object, body = code): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'adapter-'));
  await writeFile(join(dir, 'index.js'), body);
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  return dir;
}

describe('host adapters from storage', () => {
  let t: TestApp;
  const storage = new FakeStorage();
  const dirs: string[] = [];

  beforeAll(async () => {
    t = await createTestApp({ seed: true, storage });
  });

  afterAll(async () => {
    await t.close();
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  const get = (url: string) => t.app.inject({ method: 'GET', url });

  it('uploads a release directory, registers it, and serves it immutably', async () => {
    const dir = await adapterDir({
      major: 1,
      version: '0.10.0-rc.1',
      file: 'index.js',
      integrity: sri,
    });
    dirs.push(dir);
    expect(await publishAdapterDir(t.db, storage, dir)).toEqual({
      major: 1,
      adapterUrl: '/adapters/v1/0.10.0-rc.1/index.js',
      sri,
    });
    expect((await get('/v1/sdk/1')).json()).toMatchObject({
      adapterUrl: '/adapters/v1/0.10.0-rc.1/index.js',
      sri,
    });
    const res = await get('/v1/adapters/v1/0.10.0-rc.1/index.js');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/javascript');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body).toBe(code);
  });

  it('refuses a bundle that does not match its manifest', async () => {
    const dir = await adapterDir(
      { major: 1, version: '0.10.1', file: 'index.js', integrity: sri },
      `${code};alert(1)`,
    );
    dirs.push(dir);
    await expect(publishAdapterDir(t.db, storage, dir)).rejects.toThrow(/integrity/);
    expect(storage.objects.has('adapters/v1/0.10.1/index.js')).toBe(false);
  });

  it('answers errors as uncached JSON', async () => {
    const res = await get('/v1/adapters/v1/9.9.9/index.js');
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('404s unknown bundles and malformed paths', async () => {
    for (const url of [
      '/v1/adapters/v1/9.9.9/index.js',
      '/v1/adapters/1/0.10.0-rc.1/index.js',
      '/v1/adapters/v1/..%2F..%2Fx/index.js',
      '/v1/adapters/v1/0.10.0-rc.1/other.js',
    ]) {
      expect((await get(url)).statusCode).toBe(404);
    }
  });
});

describe('adapter versions', () => {
  it('uploads only release versions; dev builds are registered by URL', async () => {
    const storage = new FakeStorage();
    const dir = await adapterDir({ major: 1, version: 'dev', file: 'index.js', integrity: sri });
    await expect(publishAdapterDir({} as never, storage, dir)).rejects.toThrow(/release adapters/);
    await rm(dir, { recursive: true, force: true });
  });
});
