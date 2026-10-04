import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { games, sdkNotifications, sdkVersions } from '../src/db/schema.js';
import { GithubIssueNotifier, type Notifier, type SdkNotice } from '../src/notify/notifier.js';
import { SdkLifecycleService } from '../src/sdk/lifecycle.service.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('deprecation notices', () => {
  let t: TestApp;
  const sent: SdkNotice[] = [];
  const notifier: Notifier = { notify: vi.fn(async (n: SdkNotice) => void sent.push(n)) };

  beforeAll(async () => {
    t = await createTestApp({ seed: true, notifier });
    // block-drop and word-chain (both on SDK v1) have repositories; sample does not.
    for (const [id, repo] of [
      ['block-drop', 'team-croffle/block-drop'],
      ['word-chain', 'team-croffle/word-chain'],
    ]) {
      const res = await t.app.inject({
        method: 'PATCH',
        url: `/v1/admin/games/${id}`,
        headers: t.adminAuth,
        payload: { repo },
      });
      expect(res.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    await t.close();
  });

  it('refuses malformed repositories', async () => {
    const res = await t.app.inject({
      method: 'PATCH',
      url: '/v1/admin/games/sample',
      headers: t.adminAuth,
      payload: { repo: 'https://github.com/x/y' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('opens one notice per affected game when a major is deprecated', async () => {
    const eolAt = new Date(Date.now() + 30 * 86_400_000);
    await t.db
      .update(sdkVersions)
      .set({ deprecatedAt: new Date(Date.now() - 1000), eolAt })
      .where(eq(sdkVersions.major, 1));
    const lifecycle = t.app.get(SdkLifecycleService);
    await lifecycle.sync();
    await lifecycle.sync();
    expect(sent.map((n) => n.game.repo).toSorted()).toEqual([
      'team-croffle/block-drop',
      'team-croffle/word-chain',
    ]);
    expect(sent[0]).toMatchObject({ major: 1, status: 'deprecated', eolAt });
    expect(await t.db.select().from(sdkNotifications)).toHaveLength(2);
  });

  it('notifies again at end of life, still once', async () => {
    sent.length = 0;
    await t.db
      .update(sdkVersions)
      .set({ eolAt: new Date(Date.now() - 1000) })
      .where(eq(sdkVersions.major, 1));
    await t.app.get(SdkLifecycleService).sync();
    await t.app.get(SdkLifecycleService).sync();
    expect(sent.map((n) => n.status)).toEqual(['eol', 'eol']);
  });

  it('skips games without a repository', async () => {
    const [sample] = await t.db.select().from(games).where(eq(games.id, 'sample'));
    expect(sample?.repo).toBeNull();
    expect(sent.find((n) => n.game.id === 'sample')).toBeUndefined();
  });
});

describe('GithubIssueNotifier', () => {
  it('opens an issue with dates and the guide', async () => {
    const fetcher = vi.fn(
      async () => new Response('{}', { status: 201 }),
    ) as unknown as typeof fetch;
    await new GithubIssueNotifier('tok', 'https://gh.test', fetcher).notify({
      game: { id: 'tetris', name: 'Tetris', repo: 'team-croffle/tetris' },
      major: 1,
      status: 'deprecated',
      eolAt: new Date('2027-01-31T00:00:00Z'),
      guideUrl: 'https://guide.test',
    });
    const [url, init] =
      (fetcher as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0] ?? [];
    expect(url).toBe('https://gh.test/repos/team-croffle/tetris/issues');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' });
    const body = JSON.parse(String(init?.body)) as { title: string; body: string };
    expect(body.title).toBe('Croffle Play: SDK v1 is deprecated (end of life 2027-01-31)');
    expect(body.body).toContain('https://guide.test');
  });

  it('fails on GitHub errors so the notice can be retried', async () => {
    const fetcher = vi.fn(
      async () => new Response('nope', { status: 403 }),
    ) as unknown as typeof fetch;
    await expect(
      new GithubIssueNotifier('tok', 'https://gh.test', fetcher).notify({
        game: { id: 'x', name: 'X', repo: 'a/b' },
        major: 1,
        status: 'eol',
        eolAt: null,
        guideUrl: 'g',
      }),
    ).rejects.toThrow(/403/);
  });
});
