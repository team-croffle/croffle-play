import { describe, expect, it, vi } from 'vitest';

import { createGamePort } from '../app/utils/game-port';

function setup() {
  const listeners = new Set<(e: MessageEvent) => void>();
  const contentWindow = { postMessage: vi.fn() };
  const win = {
    addEventListener: (_: 'message', l: (e: MessageEvent) => void) => listeners.add(l),
    removeEventListener: (_: 'message', l: (e: MessageEvent) => void) => listeners.delete(l),
  };
  const port = createGamePort({ contentWindow }, 'https://tetris.games.test', win);
  const dispatch = (data: unknown, source: unknown, origin: string) => {
    for (const l of listeners) {
      l({ data, source, origin } as MessageEvent);
    }
  };
  return { port, contentWindow, dispatch, listeners };
}

describe('createGamePort', () => {
  it('posts only to the game origin', () => {
    const { port, contentWindow } = setup();
    port.post({ a: 1 });
    expect(contentWindow.postMessage).toHaveBeenCalledWith({ a: 1 }, 'https://tetris.games.test');
  });

  it('accepts messages only from the frame window and the game origin', () => {
    const { port, contentWindow, dispatch, listeners } = setup();
    const got = vi.fn();
    const off = port.onMessage(got);
    dispatch('ok', contentWindow, 'https://tetris.games.test');
    dispatch('wrong-origin', contentWindow, 'https://evil.test');
    dispatch('wrong-window', {}, 'https://tetris.games.test');
    dispatch('no-source', null, 'https://tetris.games.test');
    expect(got).toHaveBeenCalledExactlyOnceWith('ok');
    off();
    expect(listeners.size).toBe(0);
  });
});
