import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { gameDeploys, games, sdkVersions } from '../src/db/schema.js';
import { UsersService } from '../src/users/users.service.js';
import { buildZip, gameBuild, type ZipEntry } from './support/build-zip.js';
import { FakeStorage } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

describe('platform hosting: uploading a game build', () => {
  let t: TestApp;
  const storage = new FakeStorage();
  let devAuth: { authorization: string };

  beforeAll(async () => {
    t = await createTestApp({ seed: true, storage, env: { UPLOAD_MAX_FILES: '5' } });
    const dev = await t.app.get(UsersService).ensure('idp|dev');
    devAuth = await bearerFor('idp|dev');
    await t.app.inject({
      method: 'PUT',
      url: `/v1/admin/games/sample/members/${dev.id}`,
      headers: t.adminAuth,
      payload: { role: 'developer' },
    });
    await t.db.insert(sdkVersions).values({ major: 2, status: 'old' });
  });

  afterAll(async () => {
    await t.close();
  });

  const upload = async (url: string, entries: ZipEntry[], auth = t.adminAuth) =>
    t.app.inject({
      method: 'POST',
      url,
      headers: { ...auth, 'content-type': 'application/zip' },
      payload: Buffer.from(await buildZip(entries)),
    });
  const adminUpload = (id: string, entries: ZipEntry[]) =>
    upload(`/v1/admin/games/${id}/deploys`, entries);

  it('stores the build, points the game at it, and takes game.json from the zip', async () => {
    const res = await adminUpload('sample', gameBuild('sample', [], { version: '1.2.3' }));
    expect(res.statusCode, res.body).toBe(201);
    const deploy = res.json<{ id: string; active: boolean; fileCount: number; version: string }>();
    expect(deploy).toMatchObject({ active: true, fileCount: 3, version: '1.2.3' });

    const [game] = await t.db.select().from(games).where(eq(games.id, 'sample'));
    expect(game?.hosting).toBe('platform');
    expect(game?.activeDeployId).toBe(deploy.id);
    expect(game?.manifest?.id).toBe('sample');
    expect(game?.sdkMajor).toBe(1);

    const index = await storage.get(`games/sample/${deploy.id}/index.html`);
    expect(index?.contentType).toBe('text/html; charset=utf-8');
    const pointer = await storage.get('games/sample/current.json');
    expect(JSON.parse(new TextDecoder().decode(pointer?.body))).toEqual({
      deployId: deploy.id,
      entry: 'index.html',
    });
  });

  it('strips a single wrapping folder (dist/…)', async () => {
    const wrapped = gameBuild('sample').map((e) => ({ ...e, path: `dist/${e.path}` }));
    const res = await adminUpload('sample', wrapped);
    expect(res.statusCode, res.body).toBe(201);
    const { id } = res.json<{ id: string }>();
    expect(await storage.get(`games/sample/${id}/index.html`)).not.toBeNull();
  });

  it('lets game members upload through /me and refuses non-members', async () => {
    const ok = await upload('/v1/me/games/sample/deploys', gameBuild('sample'), devAuth);
    expect(ok.statusCode, ok.body).toBe(201);
    const other = await upload('/v1/me/games/duo/deploys', gameBuild('duo'), devAuth);
    expect(other.statusCode).toBe(403);
  });

  it.each<[string, ZipEntry[], number, string]>([
    ['no game.json', [{ path: 'index.html', body: 'x' }], 422, 'no game.json'],
    ['id mismatch', gameBuild('other'), 422, "says id 'other'"],
    ['missing entry', gameBuild('sample', [], { entry: 'play.html' }), 422, "entry 'play.html'"],
    ['old SDK major', gameBuild('sample', [], { sdk: '^2.0.0' }), 422, 'SDK v2 is old'],
    ['path escape', gameBuild('sample', [{ path: '../evil.js', body: 'x' }]), 400, 'Invalid zip'],
    [
      'absolute path',
      gameBuild('sample', [{ path: '/etc/passwd', body: 'x' }]),
      400,
      'Invalid zip',
    ],
    ['backslash', gameBuild('sample', [{ path: 'a\\b.js', body: 'x' }]), 400, 'Invalid zip'],
    [
      'symbolic link',
      gameBuild('sample', [{ path: 'link', body: '../../x', mode: 0o120777 }]),
      400,
      'symbolic link',
    ],
    [
      'too many files',
      gameBuild('sample', [
        { path: 'a', body: '1' },
        { path: 'b', body: '2' },
        { path: 'c', body: '3' },
      ]),
      400,
      'more than 5 files',
    ],
  ])('refuses a build with %s', async (_name, entries, status, message) => {
    const res = await adminUpload('sample', entries);
    expect(res.statusCode, res.body).toBe(status);
    expect(res.body).toContain(message);
  });

  it('refuses a file larger than the limit before inflating it', async () => {
    const big = new Uint8Array(2 * 1024 * 1024);
    const limited = await createTestApp({
      seed: true,
      storage: new FakeStorage(),
      env: { UPLOAD_MAX_FILE_BYTES: String(1024 * 1024) },
    });
    try {
      const res = await limited.app.inject({
        method: 'POST',
        url: '/v1/admin/games/sample/deploys',
        headers: { ...limited.adminAuth, 'content-type': 'application/zip' },
        payload: Buffer.from(await buildZip(gameBuild('sample', [{ path: 'big.bin', body: big }]))),
      });
      expect(res.statusCode, res.body).toBe(400);
      expect(res.body).toContain('big.bin');
    } finally {
      await limited.close();
    }
  });

  it('refuses anything but a zip body and unknown games', async () => {
    const json = await t.app.inject({
      method: 'POST',
      url: '/v1/admin/games/sample/deploys',
      headers: t.adminAuth,
      payload: { hello: 1 },
    });
    expect(json.statusCode).toBe(400);
    const missing = await adminUpload('nope', gameBuild('nope'));
    expect(missing.statusCode).toBe(404);
  });

  it('leaves no files or row behind when a later step fails', async () => {
    const before = (await storage.list('games/word-chain/')).length;
    // SDK v2 is old: validation fails after the zip is read but before any storage write.
    const res = await adminUpload('word-chain', gameBuild('word-chain', [], { sdk: '2' }));
    expect(res.statusCode).toBe(422);
    expect((await storage.list('games/word-chain/')).length).toBe(before);
    const rows = await t.db.select().from(gameDeploys).where(eq(gameDeploys.gameId, 'word-chain'));
    expect(rows).toEqual([]);
  });
});
