import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deployKeys } from '../src/db/schema.js';
import { DeployKeysService } from '../src/deploy-keys/deploy-keys.service.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('admin deploy keys', () => {
  let t: TestApp;
  let keys: DeployKeysService;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    keys = t.app.get(DeployKeysService);
  });

  afterAll(async () => {
    await t.close();
  });

  const call = (
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    headers: Record<string, string> = t.adminAuth,
  ) => t.app.inject({ method, url, headers, ...(method === 'POST' ? { payload: {} } : {}) });

  it('refuses requests without an admin access token', async () => {
    expect((await call('GET', '/v1/admin/games/sample/deploy-keys', {} as never)).statusCode).toBe(
      401,
    );
    const wrong = { authorization: 'Bearer nope' };
    expect((await call('GET', '/v1/admin/games/sample/deploy-keys', wrong)).statusCode).toBe(401);
  });

  it('issues a key once and stores only its hash', async () => {
    const res = await call('POST', '/v1/admin/games/sample/deploy-keys');
    expect(res.statusCode).toBe(201);
    const { key, id, prefix } = res.json<{ key: string; id: string; prefix: string }>();
    expect(key).toMatch(/^cpk_sample_[\w-]{43}$/);
    expect(key.startsWith(prefix)).toBe(true);
    const [row] = await t.db.select().from(deployKeys).where(eq(deployKeys.id, id));
    expect(row?.keyHash).not.toContain(key);
    const list = (await call('GET', '/v1/admin/games/sample/deploy-keys')).json<{
      items: object[];
    }>();
    expect(list.items).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(key);
  });

  it('verifies active keys and rejects revoked or expired ones', async () => {
    const a = (await call('POST', '/v1/admin/games/block-drop/deploy-keys')).json<{
      key: string;
      id: string;
    }>();
    expect((await keys.verify(a.key))?.gameId).toBe('block-drop');
    expect(await keys.verify(`${a.key}x`)).toBeNull();
    expect(await keys.verify('not-a-key')).toBeNull();

    const del = await call('DELETE', `/v1/admin/games/block-drop/deploy-keys/${a.id}`);
    expect(del.statusCode).toBe(204);
    expect(await keys.verify(a.key)).toBeNull();

    const b = await keys.issue('block-drop');
    await t.db
      .update(deployKeys)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(deployKeys.id, b.id));
    expect(await keys.verify(b.key)).toBeNull();
  });

  it('rotates: a new key now, the old one for 24 more hours', async () => {
    const old = await keys.issue('sample', 'ci', 'deploy');
    const res = await call('POST', `/v1/admin/games/sample/deploy-keys/${old.id}/rotate`);
    expect(res.statusCode).toBe(201);
    const fresh = res.json<{ key: string; label: string; kind: string }>();
    expect(fresh).toMatchObject({ label: 'ci', kind: 'deploy' });
    expect(await keys.verify(fresh.key)).not.toBeNull();
    const stillValid = await keys.verify(old.key);
    expect(stillValid?.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(stillValid?.expiresAt?.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 3_600_000);
  });

  it('404s for unknown games and keys', async () => {
    expect((await call('POST', '/v1/admin/games/nope/deploy-keys')).statusCode).toBe(404);
    const missing = '/v1/admin/games/sample/deploy-keys/00000000-0000-4000-8000-000000000000';
    expect((await call('DELETE', missing)).statusCode).toBe(404);
  });
});
