import { parseManifest } from '@croffledev/play-protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GameServersService } from '../src/game-servers/game-servers.service.js';
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
  let servers: GameServersService;

  beforeAll(async () => {
    t = await createTestApp({
      seed: true,
      env: { GAME_SERVER_URL_TEMPLATE: 'https://{id}.srv.croffle-play.link' },
    });
    servers = t.app.get(GameServersService);
  });

  afterAll(async () => {
    await t.close();
  });

  const admin = (method: 'GET' | 'POST', url: string) =>
    t.app.inject({ method, url, headers: t.adminAuth });
  const publicInfo = () => t.app.inject({ method: 'GET', url: '/v1/games/block-drop/server' });

  it('records a request for a needsServer manifest', async () => {
    const m = parseManifest(manifest('2.0.0', { protocol: '1.0.0', image: IMAGE }));
    await servers.onVersionUploaded('block-drop', m.ok ? m.manifest : (undefined as never));
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

  it('renders an isolated compose service for the approved image', async () => {
    const res = await admin('GET', '/v1/admin/games/block-drop/server/compose');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/yaml');
    const yaml = res.body;
    for (const line of [
      `image: ${IMAGE}`,
      'read_only: true',
      'cap_drop: [ALL]',
      "security_opt: ['no-new-privileges:true']",
      'pids: 256',
      'networks: [games-net]',
      'TOKEN_AUDIENCE: game:block-drop',
      'PLATFORM_JWKS_URL: http://localhost:3001/.well-known/jwks.json',
      'traefik.http.routers.game-block-drop.rule: Host(`block-drop.srv.croffle-play.link`)',
      "traefik.http.middlewares.game-block-drop-nocookie.headers.customresponseheaders.Set-Cookie: ''",
    ]) {
      expect(yaml).toContain(line);
    }
    expect(yaml).not.toMatch(/data-net|storage-net|platform-net|privileged|DATABASE_URL/);
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
