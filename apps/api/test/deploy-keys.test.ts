import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deployKeys, gameDeploys } from '../src/db/schema.js';
import { UsersService } from '../src/users/users.service.js';
import { buildZip, gameBuild } from './support/build-zip.js';
import { FakeStorage } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

interface Issued {
  key: string;
  id: string;
  prefix: string;
}

describe('deploy keys: issue, upload with a key, rotate, revoke', () => {
  let t: TestApp;
  let devAuth: { authorization: string };

  beforeAll(async () => {
    t = await createTestApp({ seed: true, storage: new FakeStorage() });
    const dev = await t.app.get(UsersService).ensure('idp|dev');
    devAuth = await bearerFor('idp|dev');
    await t.app.inject({
      method: 'PUT',
      url: `/v1/admin/games/sample/members/${dev.id}`,
      headers: t.adminAuth,
      payload: { role: 'developer' },
    });
  });

  afterAll(async () => {
    await t.close();
  });

  const uploadWith = async (id: string, key: string) =>
    t.app.inject({
      method: 'POST',
      url: `/v1/games/${id}/deploys`,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/zip' },
      payload: Buffer.from(await buildZip(gameBuild(id))),
    });

  it('issues a key once (hash stored) and uploads a build with it', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/v1/admin/games/sample/deploy-keys',
      headers: t.adminAuth,
      payload: { label: 'ci' },
    });
    expect(res.statusCode, res.body).toBe(201);
    const issued = res.json<Issued>();
    expect(issued.key).toMatch(/^cdk_sample_[\w-]{43}$/);
    const [row] = await t.db.select().from(deployKeys).where(eq(deployKeys.id, issued.id));
    expect(row?.keyHash).not.toContain(issued.key);
    expect(row?.label).toBe('ci');

    const up = await uploadWith('sample', issued.key);
    expect(up.statusCode, up.body).toBe(201);
    const deploy = up.json<{ id: string; deployKeyId: string; uploadedBy: string | null }>();
    expect(deploy.deployKeyId).toBe(issued.id);
    expect(deploy.uploadedBy).toBeNull();
    const [stored] = await t.db.select().from(gameDeploys).where(eq(gameDeploys.id, deploy.id));
    expect(stored?.deployKeyId).toBe(issued.id);
    const [used] = await t.db.select().from(deployKeys).where(eq(deployKeys.id, issued.id));
    expect(used?.lastUsedAt).not.toBeNull();
  });

  it('refuses another game, a server key, a bad key and no key', async () => {
    const issued = (
      await t.app.inject({
        method: 'POST',
        url: '/v1/admin/games/duo/deploy-keys',
        headers: t.adminAuth,
        payload: {},
      })
    ).json<Issued>();
    expect((await uploadWith('sample', issued.key)).statusCode).toBe(403);
    const csk = (
      await t.app.inject({
        method: 'POST',
        url: '/v1/admin/games/sample/server-keys',
        headers: t.adminAuth,
        payload: {},
      })
    ).json<Issued>();
    expect((await uploadWith('sample', csk.key)).statusCode).toBe(401);
    expect((await uploadWith('sample', 'cdk_sample_nope')).statusCode).toBe(401);
    const none = await t.app.inject({
      method: 'POST',
      url: '/v1/games/sample/deploys',
      headers: { 'content-type': 'application/zip' },
      payload: Buffer.from(await buildZip(gameBuild('sample'))),
    });
    expect(none.statusCode).toBe(401);
  });

  it('lets members manage their game keys, rotates with a grace period, revokes', async () => {
    const issued = (
      await t.app.inject({
        method: 'POST',
        url: '/v1/me/games/sample/deploy-keys',
        headers: devAuth,
        payload: { label: 'laptop' },
      })
    ).json<Issued>();
    expect(issued.key).toMatch(/^cdk_sample_/);
    const list = await t.app.inject({
      method: 'GET',
      url: '/v1/me/games/sample/deploy-keys',
      headers: devAuth,
    });
    expect(list.statusCode).toBe(200);
    expect(list.body).not.toContain(issued.key);

    const rotated = await t.app.inject({
      method: 'POST',
      url: `/v1/me/games/sample/deploy-keys/${issued.id}/rotate`,
      headers: devAuth,
    });
    expect(rotated.statusCode, rotated.body).toBe(201);
    const next = rotated.json<Issued>();
    expect((await uploadWith('sample', issued.key)).statusCode).toBe(201); // still in grace
    expect((await uploadWith('sample', next.key)).statusCode).toBe(201);

    const revoke = await t.app.inject({
      method: 'DELETE',
      url: `/v1/me/games/sample/deploy-keys/${next.id}`,
      headers: devAuth,
    });
    expect(revoke.statusCode).toBe(204);
    expect((await uploadWith('sample', next.key)).statusCode).toBe(401);

    const other = await t.app.inject({
      method: 'GET',
      url: '/v1/me/games/duo/deploy-keys',
      headers: devAuth,
    });
    expect(other.statusCode).toBe(403);
  });
});
