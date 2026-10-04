import { parseManifest } from '@croffledev/play-protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DeployKeysService } from '../src/deploy-keys/deploy-keys.service.js';
import { GameServersService } from '../src/game-servers/game-servers.service.js';
import { FakeStorage, sha256b64 } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

const IMAGE = 'ghcr.io/team-croffle/block-drop-server:1.0.0';

function manifest(version: string, server: { protocol: string; image: string }) {
  return {
    id: 'block-drop',
    name: 'Block Drop',
    version,
    thumbnail: 't.png',
    sdk: '^1.0.0',
    needsServer: true,
    server,
  };
}

describe('game servers', () => {
  let t: TestApp;
  let storage: FakeStorage;
  let servers: GameServersService;

  beforeAll(async () => {
    storage = new FakeStorage();
    t = await createTestApp({ seed: true, storage });
    servers = t.app.get(GameServersService);
  });

  afterAll(async () => {
    await t.close();
  });

  const admin = (method: 'GET' | 'POST', url: string) =>
    t.app.inject({ method, url, headers: t.adminAuth });
  const publicInfo = () => t.app.inject({ method: 'GET', url: '/v1/games/block-drop/server' });

  it('requests approval when a needsServer version finishes uploading', async () => {
    const key = (await t.app.get(DeployKeysService).issue('block-drop')).key;
    const m = manifest('2.0.0', { protocol: '1.0.0', image: IMAGE });
    const files = { 'index.html': 'x', 't.png': 'p', 'game.json': JSON.stringify(m) };
    const declared = await t.app.inject({
      method: 'POST',
      url: '/v1/games/block-drop/versions',
      headers: { authorization: `Bearer ${key}` },
      payload: {
        manifest: m,
        files: Object.entries(files).map(([path, body]) => ({
          path,
          size: body.length,
          sha256: sha256b64(body),
        })),
      },
    });
    expect(declared.statusCode).toBe(201);
    for (const [path, body] of Object.entries(files)) {
      storage.upload(`block-drop/2.0.0/${path}`, body);
    }
    const done = await t.app.inject({
      method: 'POST',
      url: '/v1/games/block-drop/versions/2.0.0/complete',
      headers: { authorization: `Bearer ${key}` },
    });
    expect(done.statusCode).toBe(200);
    expect((await admin('GET', '/v1/admin/game-servers')).json()).toMatchObject({
      items: [{ gameId: 'block-drop', image: IMAGE, status: 'requested' }],
    });
    expect((await publicInfo()).statusCode).toBe(404);
  });

  it('serves the address only after approval, and only admins approve', async () => {
    const player = await t.app.inject({
      method: 'POST',
      url: '/v1/admin/games/block-drop/server/approve',
      headers: await bearerFor('idp|player'),
    });
    expect(player.statusCode).toBe(403);
    expect((await admin('POST', '/v1/admin/games/block-drop/server/approve')).json()).toMatchObject(
      {
        status: 'approved',
        approvedAt: expect.any(String),
      },
    );
    expect((await publicInfo()).json()).toEqual({
      url: 'https://block-drop.srv.croffle-play.link',
      protocol: '1.0.0',
    });
  });

  it('keeps approval for the same image and asks again for a new one', async () => {
    const same = parseManifest(manifest('2.0.1', { protocol: '1.0.0', image: IMAGE }));
    await servers.onVersionUploaded('block-drop', same.ok ? same.manifest : (undefined as never));
    expect((await servers.get('block-drop')).status).toBe('approved');
    const next = parseManifest(
      manifest('2.1.0', { protocol: '1.1.0', image: `${IMAGE.slice(0, -5)}1.1.0` }),
    );
    await servers.onVersionUploaded('block-drop', next.ok ? next.manifest : (undefined as never));
    expect(await servers.get('block-drop')).toMatchObject({
      status: 'requested',
      approvedAt: null,
    });
    expect((await publicInfo()).statusCode).toBe(404);
  });

  it('revokes', async () => {
    await admin('POST', '/v1/admin/games/block-drop/server/approve');
    expect((await admin('POST', '/v1/admin/games/block-drop/server/revoke')).json()).toMatchObject({
      status: 'revoked',
    });
    expect((await publicInfo()).statusCode).toBe(404);
    expect((await admin('GET', '/v1/admin/games/sample/server')).statusCode).toBe(404);
  });
});
