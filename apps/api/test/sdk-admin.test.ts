import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sdkVersions } from '../src/db/schema.js';
import { registerAdapter } from '../src/sdk/register-adapter.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const sri = (code: string) => `sha384-${createHash('sha384').update(code).digest('base64')}`;
const day = 86_400_000;

interface Detail {
  status: string;
  adapterUrl: string | null;
  oldAt: string | null;
  deprecatedAt: string | null;
  imageWins: boolean;
  adapters: { version: string; active: boolean; source: string }[];
  events: { kind: string; actor: string | null; to: Record<string, unknown> }[];
}

describe('admin SDK management', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    for (const version of ['0.12.0', '0.13.0']) {
      await registerAdapter(
        t.db,
        { major: 1, version, file: 'index.js', integrity: sri(version) },
        `/adapters/v1/${version}/index.js`,
        'cli',
      );
    }
    await registerAdapter(
      t.db,
      { major: 1, version: 'dev', file: 'index.js', integrity: sri('dev') },
      'http://localhost:4100/adapters/v1/dev/index.js',
      'dev',
    );
    await t.db.insert(sdkVersions).values({ major: 2, status: 'current' });
  });

  afterAll(async () => {
    await t.close();
  });

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    t.app.inject({ method, url, headers: t.adminAuth, ...(payload ? { payload } : {}) });
  const detail = async (major = 1) => (await call('GET', `/v1/admin/sdk/${major}`)).json<Detail>();

  it('shows registered adapter versions, the active one and recorded changes', async () => {
    const d = await detail();
    expect(d.adapterUrl).toBe('http://localhost:4100/adapters/v1/dev/index.js');
    expect(d.adapters.map((a) => [a.version, a.source, a.active]).toSorted()).toEqual([
      ['0.12.0', 'cli', false],
      ['0.13.0', 'cli', false],
      ['dev', 'dev', true],
    ]);
    expect(d.events.filter((e) => e.kind === 'adapter_activated')).toHaveLength(3);
    expect(d.imageWins).toBe(true);
    expect((await call('GET', '/v1/admin/sdk/9')).statusCode).toBe(404);
  });

  it('activates a registered version with the admin as actor, never a dev one', async () => {
    const res = await call('POST', '/v1/admin/sdk/1/adapter', { version: '0.12.0' });
    expect(res.statusCode, res.body).toBe(200);
    const d = res.json<Detail>();
    expect(d.adapterUrl).toBe('/adapters/v1/0.12.0/index.js');
    expect(d.adapters.find((a) => a.version === '0.12.0')?.active).toBe(true);
    expect(d.events[0]).toMatchObject({ kind: 'adapter_activated', to: { version: '0.12.0' } });
    expect(d.events[0]?.actor).not.toBeNull();
    expect((await call('POST', '/v1/admin/sdk/1/adapter', { version: 'dev' })).statusCode).toBe(
      404,
    );
    expect((await call('POST', '/v1/admin/sdk/1/adapter', { version: '9.9.9' })).statusCode).toBe(
      404,
    );
  });

  it('moves the lifecycle forward only and records it', async () => {
    const lts = await call('PATCH', '/v1/admin/sdk/1', { status: 'lts' });
    expect(lts.statusCode, lts.body).toBe(200);
    expect(lts.json<Detail>().status).toBe('lts');
    expect((await call('PATCH', '/v1/admin/sdk/1', { status: 'current' })).statusCode).toBe(422);
    expect(lts.json<Detail>().events[0]).toMatchObject({
      kind: 'status_changed',
      to: { status: 'lts' },
    });
  });

  it('schedules old and deprecated dates in order and applies a past date at once', async () => {
    const bad = await call('PATCH', '/v1/admin/sdk/1', {
      oldAt: new Date(Date.now() + 30 * day).toISOString(),
      deprecatedAt: new Date(Date.now() + 10 * day).toISOString(),
    });
    expect(bad.statusCode).toBe(400);
    const ok = await call('PATCH', '/v1/admin/sdk/1', {
      oldAt: new Date(Date.now() - day).toISOString(),
      deprecatedAt: new Date(Date.now() + 90 * day).toISOString(),
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json<Detail>().status).toBe('old');
    expect(ok.json<Detail>().events[0]?.kind).toBe('schedule_changed');
    const [row] = await t.db.select().from(sdkVersions).where(eq(sdkVersions.major, 1));
    expect(row?.status).toBe('old'); // the sync persisted what the date implies
  });

  it('deprecates only with the major typed back, and never undoes it', async () => {
    const noConfirm = await call('PATCH', '/v1/admin/sdk/2', { status: 'deprecated' });
    expect(noConfirm.statusCode).toBe(400);
    expect(noConfirm.body).toContain('confirm: 2');
    const wrong = await call('PATCH', '/v1/admin/sdk/2', { status: 'deprecated', confirm: 1 });
    expect(wrong.statusCode).toBe(400);
    const done = await call('PATCH', '/v1/admin/sdk/2', { status: 'deprecated', confirm: 2 });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json<Detail>().status).toBe('deprecated');
    expect((await call('PATCH', '/v1/admin/sdk/2', { status: 'lts' })).statusCode).toBe(422);
    expect((await call('PATCH', '/v1/admin/sdk/2', { oldAt: null })).statusCode).toBe(422);
  });

  it('is admin only', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/v1/admin/sdk/1' })).statusCode).toBe(401);
  });
});
