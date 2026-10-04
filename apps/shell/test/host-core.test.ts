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

  it('treats everyone as a guest until accounts exist', async () => {
    expect(await core().core.identity.getUser()).toBeNull();
  });
});
