import { describe, expect, it, vi } from 'vitest';

import { createHostCore } from '../app/utils/host-core';

function core(fetchJson = vi.fn().mockResolvedValue({ ok: true })) {
  const doc = {
    fullscreenElement: null,
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Document;
  return {
    fetchJson,
    core: createHostCore({
      gameId: 'tetris',
      version: '1.0.0',
      stage: () => null,
      onGameReady: vi.fn(),
      onNotify: vi.fn(),
      onExit: vi.fn(),
      onLoginRequested: vi.fn(),
      getUser: async () => null,
      fetchJson,
      doc,
    }),
  };
}

describe('createHostCore', () => {
  it('routes api calls to the shell /api', async () => {
    const { core: c, fetchJson } = core();
    await c.api('POST', 'games/tetris/scores', { score: 1 });
    expect(fetchJson).toHaveBeenCalledWith('/api/games/tetris/scores', {
      method: 'POST',
      body: { score: 1 },
    });
  });

  it('refuses paths that could leave /api', async () => {
    const { core: c, fetchJson } = core();
    for (const path of ['../admin', '/abs', 'https://evil.test', 'games/../../x', '']) {
      await expect(c.api('GET', path)).rejects.toMatchObject({ status: 400 });
    }
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('allows simple query strings', async () => {
    const { core: c, fetchJson } = core();
    await c.api('GET', 'games/tetris/leaderboard?limit=5');
    expect(fetchJson).toHaveBeenCalledWith('/api/games/tetris/leaderboard?limit=5', {
      method: 'GET',
      body: undefined,
    });
    await expect(c.api('GET', 'games/x?a=<script>')).rejects.toMatchObject({ status: 400 });
  });
});
