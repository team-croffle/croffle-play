import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { gameVersions, games, sdkVersions } from '../src/db/schema.js';
import { DeployKeysService } from '../src/deploy-keys/deploy-keys.service.js';
import { FakeStorage, sha256b64 } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const bundle: Record<string, string> = {
  'index.html': '<!doctype html><script src="./main.js"></script>',
  'main.js': 'console.log(1)',
  'thumb.png': 'png-bytes',
};

function manifest(version: string, extra: object = {}) {
  return {
    id: 'block-drop',
    name: 'Block Drop',
    version,
    thumbnail: 'thumb.png',
    sdk: '^1.0.0',
    ...extra,
  };
}

function files(version: string, extra: object = {}) {
  const all = { ...bundle, 'game.json': JSON.stringify(manifest(version, extra)) };
  return Object.entries(all).map(([path, body]) => ({
    path,
    size: Buffer.byteLength(body),
    sha256: sha256b64(body),
  }));
}

describe('publish', () => {
  let t: TestApp;
  let storage: FakeStorage;
  let key: string;
  let otherKey: string;

  beforeAll(async () => {
    storage = new FakeStorage();
    t = await createTestApp({
      seed: true,
      storage,
      env: { GAME_URL_TEMPLATE: 'https://{id}.g.test/{version}/' },
    });
    key = (await t.app.get(DeployKeysService).issue('block-drop')).key;
    otherKey = (await t.app.get(DeployKeysService).issue('sample')).key;
  });

  beforeEach(() => {
    storage.presigned.length = 0;
  });

  afterAll(async () => {
    await t.close();
  });

  const declare = (version: string, opts: { auth?: string; extra?: object; body?: object } = {}) =>
    t.app.inject({
      method: 'POST',
      url: '/v1/games/block-drop/versions',
      headers: { authorization: `Bearer ${opts.auth ?? key}` },
      payload: opts.body ?? {
        manifest: manifest(version, opts.extra),
        files: files(version, opts.extra),
      },
    });

  const complete = (version: string) =>
    t.app.inject({
      method: 'POST',
      url: `/v1/games/block-drop/versions/${version}/complete`,
      headers: { authorization: `Bearer ${key}` },
    });

  const uploadAll = (version: string, extra: object = {}) => {
    const all = { ...bundle, 'game.json': JSON.stringify(manifest(version, extra)) };
    for (const [path, body] of Object.entries(all)) {
      storage.upload(`block-drop/${version}/${path}`, body);
    }
  };

  it('requires the deploy key of this game', async () => {
    expect((await declare('2.0.0', { auth: 'cpk_nope' })).statusCode).toBe(401);
    expect((await declare('2.0.0', { auth: otherKey })).statusCode).toBe(403);
  });

  it('presigns one URL per file under the version path', async () => {
    const res = await declare('2.0.0');
    expect(res.statusCode).toBe(201);
    const body = res.json<{ uploads: { path: string; url: string }[] }>();
    expect(body.uploads.map((u) => u.path).toSorted()).toEqual([
      'game.json',
      'index.html',
      'main.js',
      'thumb.png',
    ]);
    expect(storage.presigned.find((p) => p.key === 'block-drop/2.0.0/main.js')).toMatchObject({
      contentType: 'text/javascript; charset=utf-8',
      contentLength: 14,
    });
  });

  it('refuses to complete until every file matches, then moves the preview pointer', async () => {
    storage.upload('block-drop/2.0.0/index.html', bundle['index.html'] ?? '');
    storage.upload('block-drop/2.0.0/main.js', 'tampered');
    const bad = await complete('2.0.0');
    expect(bad.statusCode).toBe(422);
    expect(
      bad
        .json<{ problems: { path: string }[] }>()
        .problems.map((p) => p.path)
        .toSorted(),
    ).toEqual(['game.json', 'main.js', 'thumb.png']);

    uploadAll('2.0.0');
    const ok = await complete('2.0.0');
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({
      version: '2.0.0',
      previewUrl: 'https://block-drop.g.test/2.0.0/index.html',
    });
    const [game] = await t.db.select().from(games).where(eq(games.id, 'block-drop'));
    expect(game).toMatchObject({ previewVersion: '2.0.0', stableVersion: '1.2.0' });
  });

  it('never replaces a completed version', async () => {
    expect((await declare('2.0.0')).statusCode).toBe(409);
    expect((await complete('2.0.0')).statusCode).toBe(409);
    expect((await declare('1.2.0')).statusCode).toBe(409);
  });

  it('lets an unfinished version be declared again', async () => {
    expect((await declare('2.1.0')).statusCode).toBe(201);
    expect((await declare('2.1.0')).statusCode).toBe(201);
    const rows = await t.db.select().from(gameVersions).where(eq(gameVersions.version, '2.1.0'));
    expect(rows).toHaveLength(1);
  });

  it('validates the manifest and the file list', async () => {
    const wrongId = await declare('3.0.0', {
      body: { manifest: { ...manifest('3.0.0'), id: 'sample' }, files: files('3.0.0') },
    });
    expect(wrongId.statusCode).toBe(422);
    const invalid = await declare('3.0.0', {
      body: { manifest: { id: 'block-drop' }, files: files('3.0.0') },
    });
    expect(invalid.json()).toMatchObject({
      issues: expect.arrayContaining([{ path: 'version', message: expect.any(String) }]),
    });
    const noThumb = await declare('3.0.0', {
      body: {
        manifest: manifest('3.0.0'),
        files: files('3.0.0').filter((f) => f.path !== 'thumb.png'),
      },
    });
    expect(noThumb.statusCode).toBe(422);
    const escape = await declare('3.0.0', {
      body: {
        manifest: manifest('3.0.0'),
        files: [...files('3.0.0'), { path: '../x', size: 1, sha256: sha256b64('x') }],
      },
    });
    expect(escape.statusCode).toBe(400);
  });

  it('enforces the bundle size limit', async () => {
    const big = files('3.1.0');
    big.push({ path: 'huge.bin', size: 31 * 1024 * 1024, sha256: sha256b64('x') });
    expect(
      (await declare('3.1.0', { body: { manifest: manifest('3.1.0'), files: big } })).statusCode,
    ).toBe(413);
    await t.db
      .update(games)
      .set({ maxBundleBytes: 64 * 1024 * 1024 })
      .where(eq(games.id, 'block-drop'));
    expect(
      (await declare('3.1.0', { body: { manifest: manifest('3.1.0'), files: big } })).statusCode,
    ).toBe(201);
  });

  it('refuses deprecated, end-of-life, and unknown SDK majors', async () => {
    expect((await declare('4.0.0', { extra: { sdk: '^9.0.0' } })).statusCode).toBe(422);
    await t.db.update(sdkVersions).set({ status: 'deprecated' }).where(eq(sdkVersions.major, 1));
    const res = await declare('4.0.0');
    expect(res.statusCode).toBe(422);
    expect(res.json<{ message: string }>().message).toMatch(/deprecated/);
    await t.db.update(sdkVersions).set({ status: 'current' }).where(eq(sdkVersions.major, 1));
  });
});
