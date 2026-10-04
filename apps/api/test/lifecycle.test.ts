import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { sdkVersionEvents, sdkVersions } from '../src/db/schema.js';
import { effectiveStatus } from '../src/sdk/lifecycle.js';
import { SdkLifecycleService } from '../src/sdk/lifecycle.service.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const day = 86_400_000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day);

const sdkRow = (
  status: 'current' | 'lts' | 'eol',
  deprecatedAt: Date | null,
  eolAt: Date | null,
) => ({
  status,
  deprecatedAt,
  eolAt,
});

describe('effectiveStatus', () => {
  it('applies dates over the stored status', () => {
    expect(effectiveStatus(sdkRow('lts', null, null))).toBe('lts');
    expect(effectiveStatus(sdkRow('lts', at(1), at(30)))).toBe('lts');
    expect(effectiveStatus(sdkRow('lts', at(-1), at(30)))).toBe('deprecated');
    expect(effectiveStatus(sdkRow('lts', at(-30), at(-1)))).toBe('eol');
    expect(effectiveStatus(sdkRow('current', null, at(-1)))).toBe('eol');
  });

  it('never revives an end-of-life major', () => {
    expect(effectiveStatus(sdkRow('eol', at(-2), null))).toBe('eol');
  });
});

describe('SDK lifecycle sync', () => {
  let t: TestApp;
  let sync: SdkLifecycleService;

  beforeAll(async () => {
    t = await createTestApp({ seed: true });
    sync = t.app.get(SdkLifecycleService);
    await t.db.insert(sdkVersions).values([
      { major: 2, status: 'current' },
      { major: 3, status: 'current' },
      { major: 4, status: 'current' },
    ]);
  });

  afterAll(async () => {
    await t.close();
  });

  it('serves the effective status before the job has run', async () => {
    await t.db
      .update(sdkVersions)
      .set({ status: 'lts', deprecatedAt: at(-1), eolAt: at(90) })
      .where(eq(sdkVersions.major, 1));
    expect((await t.app.inject({ method: 'GET', url: '/v1/sdk/1' })).json()).toMatchObject({
      status: 'deprecated',
    });
  });

  it('persists each transition once and tells listeners', async () => {
    const listener = vi.fn(async () => undefined);
    sync.onTransition(listener);
    expect(await sync.sync()).toMatchObject([{ major: 1, from: 'lts', to: 'deprecated' }]);
    expect(await sync.sync()).toEqual([]);
    expect(listener).toHaveBeenCalledOnce();
    const events = await t.db.select().from(sdkVersionEvents);
    expect(events).toMatchObject([{ major: 1, fromStatus: 'lts', toStatus: 'deprecated' }]);
    const [row] = await t.db.select().from(sdkVersions).where(eq(sdkVersions.major, 1));
    expect(row?.status).toBe('deprecated');
  });

  it('warns admins when too many majors are active', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/v1/admin/sdk', headers: t.adminAuth });
    expect(res.json<{ items: unknown[]; warnings: string[] }>().warnings).toEqual([]);
    await t.db.insert(sdkVersions).values({ major: 5, status: 'current' });
    const after = await t.app.inject({ method: 'GET', url: '/v1/admin/sdk', headers: t.adminAuth });
    expect(after.json<{ warnings: string[] }>().warnings[0]).toMatch(/4 SDK majors are active/);
  });
});
