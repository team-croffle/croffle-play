import { request } from '@croffledev/play-protocol';
import type { GamePort, HostCore } from '@croffledev/play-protocol/host';
import { describe, expect, it, vi } from 'vitest';

import { major, mount } from '../src/index.js';

function setup(overrides: { api?: HostCore['api'] } = {}) {
  let toAdapter: ((m: unknown) => void) | undefined;
  let visibility: ((visible: boolean) => void) | undefined;
  const posted: unknown[] = [];
  const port: GamePort = {
    post: (m) => posted.push(m),
    onMessage: (l) => {
      toAdapter = l;
      return () => {
        toAdapter = undefined;
      };
    },
  };
  const core: HostCore = {
    identity: { getUser: vi.fn().mockResolvedValue({ id: 'u1', nickname: 'Kim', avatar: null }) },
    api: overrides.api ?? (vi.fn().mockResolvedValue({ accepted: true }) as HostCore['api']),
    ui: {
      gameReady: vi.fn(),
      setFullscreen: vi.fn().mockResolvedValue(true),
      notify: vi.fn(),
      requestLogin: vi.fn(),
    },
    lifecycle: {
      gameId: 'tetris',
      version: '1.0.0',
      exit: vi.fn(),
      onVisibility: (l) => {
        visibility = l;
        return () => {
          visibility = undefined;
        };
      },
    },
  };
  const adapter = mount({ core, port, sdkVersion: '1.0.0' });
  const send = async (msg: unknown) => {
    toAdapter?.(msg);
    await vi.waitFor(() => expect(posted.length).toBeGreaterThan(0));
    return posted.shift();
  };
  return { adapter, core, posted, send, visibility: (vis: boolean) => visibility?.(vis), port };
}

describe('host adapter v1', () => {
  it('is for SDK major 1 and announces its capabilities', () => {
    expect(major).toBe(1);
    expect(setup().adapter.capabilities).toEqual(['user', 'score', 'fullscreen', 'exit']);
  });

  it('maps requests to the core', async () => {
    const { core, send } = setup();
    expect(await send(request('1', 'getUser'))).toMatchObject({
      ok: true,
      payload: { id: 'u1', nickname: 'Kim' },
    });
    expect(await send(request('2', 'submitScore', { score: 5 }))).toMatchObject({
      ok: true,
      payload: { accepted: true },
    });
    expect(core.api).toHaveBeenCalledWith('POST', 'games/tetris/scores', { score: 5 });
    expect(await send(request('3', 'ready'))).toMatchObject({ id: '3', ok: true });
    expect(core.ui.gameReady).toHaveBeenCalled();
    expect(await send(request('4', 'fullscreen', { on: true }))).toMatchObject({
      payload: { on: true },
    });
    expect(await send(request('5', 'exit'))).toMatchObject({ ok: true });
    expect(core.lifecycle.exit).toHaveBeenCalled();
  });

  it('answers unsupported and invalid requests', async () => {
    const { send } = setup();
    expect(await send(request('1', 'save', { slot: 'a', data: '' }))).toMatchObject({
      ok: false,
      error: { code: 'unsupported' },
    });
    expect(await send(request('2', 'nonsense'))).toMatchObject({ error: { code: 'unsupported' } });
    expect(await send(request('3', 'submitScore', { score: 'x' }))).toMatchObject({
      error: { code: 'invalid_request' },
    });
  });

  it('maps core HTTP failures to protocol errors', async () => {
    const api = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { status: 401 }));
    const { send } = setup({ api: api as HostCore['api'] });
    expect(await send(request('1', 'submitScore', { score: 1 }))).toMatchObject({
      error: { code: 'auth_required' },
    });
  });

  it('forwards visibility as pause/resume and stops after dispose', () => {
    const { adapter, posted, visibility } = setup();
    visibility(false);
    visibility(true);
    expect(posted).toMatchObject([
      { kind: 'evt', type: 'pause' },
      { kind: 'evt', type: 'resume' },
    ]);
    adapter.dispose();
    visibility(false);
    expect(posted).toHaveLength(2);
  });

  it('ignores foreign messages', async () => {
    const { posted, send } = setup();
    await expect(send({ type: 'webpackOk' })).rejects.toThrow();
    expect(posted).toHaveLength(0);
  });
});
