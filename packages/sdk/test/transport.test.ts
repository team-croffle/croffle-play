import { describe, expect, it, vi } from 'vitest';

import { type WindowLike, windowTransport } from '../src/transport.js';

function fakeWindow() {
  const listeners = new Set<(e: MessageEvent) => void>();
  const parent = { postMessage: vi.fn() };
  const win: WindowLike = {
    parent,
    addEventListener: (_t, l) => listeners.add(l),
    removeEventListener: (_t, l) => listeners.delete(l),
  };
  const dispatch = (data: unknown, source: unknown, origin: string) => {
    for (const l of listeners) {
      l({ data, source, origin } as MessageEvent);
    }
  };
  return { win, parent, dispatch, listeners };
}

describe('windowTransport', () => {
  it('posts to the parent with the given target origin', () => {
    const { win, parent } = fakeWindow();
    windowTransport(win).send({ a: 1 }, 'https://play.test');
    expect(parent.postMessage).toHaveBeenCalledWith({ a: 1 }, 'https://play.test');
  });

  it('only delivers messages whose source is the parent', () => {
    const { win, parent, dispatch, listeners } = fakeWindow();
    const got = vi.fn();
    const off = windowTransport(win).onMessage(got);
    dispatch('from-parent', parent, 'https://play.test');
    dispatch('from-elsewhere', {}, 'https://play.test');
    expect(got).toHaveBeenCalledExactlyOnceWith('from-parent', 'https://play.test');
    off();
    expect(listeners.size).toBe(0);
  });
});
