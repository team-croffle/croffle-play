import { describe, expect, it, vi } from 'vitest';

import { createSdk } from '../src/index.js';
import { createMockHost, memoryStorage } from '../src/mock/index.js';

const quiet = { log: false } as const;

describe('createMockHost', () => {
  it('answers every v1 request', async () => {
    const host = createMockHost({ ...quiet, storage: memoryStorage() });
    const sdk = await createSdk({ game: 'tetris', transport: host });
    expect(sdk.has('score')).toBe(true);
    await sdk.ready();
    expect(await sdk.getUser()).toEqual({ id: 'mock-user', nickname: 'Player', avatar: null });
    expect(await sdk.submitScore(7)).toEqual({ accepted: true });
    expect(host.scores).toEqual([7]);
    expect(await sdk.load('main')).toBeNull();
    await sdk.save('main', '{"lvl":2}');
    expect(await sdk.load('main')).toBe('{"lvl":2}');
    expect(await sdk.setFullscreen(true)).toBe(true);
    expect(await sdk.getLeaderboard()).toEqual([
      { rank: 1, user: { id: 'mock-user', nickname: 'Player', avatar: null }, score: 7 },
    ]);
    await sdk.exit();
  });

  it('keeps saves per game', async () => {
    const storage = memoryStorage();
    const a = await createSdk({ game: 'a', transport: createMockHost({ ...quiet, storage }) });
    const b = await createSdk({ game: 'b', transport: createMockHost({ ...quiet, storage }) });
    await a.save('s', 'A');
    expect(await b.load('s')).toBeNull();
  });

  it('simulates a guest', async () => {
    const host = createMockHost({ ...quiet, user: null, storage: memoryStorage() });
    const sdk = await createSdk({ game: 'x', transport: host });
    expect(await sdk.getUser()).toBeNull();
    expect(await sdk.submitScore(1)).toEqual({ accepted: false });
    await expect(sdk.save('s', '')).rejects.toMatchObject({ code: 'auth_required' });
  });

  it('honours limited capabilities and emits events', async () => {
    const host = createMockHost({ ...quiet, capabilities: ['user'] });
    const sdk = await createSdk({ game: 'x', transport: host });
    await expect(sdk.submitScore(1)).rejects.toMatchObject({ code: 'unsupported' });
    const resume = vi.fn();
    sdk.on('resume', resume);
    host.emit('resume');
    await vi.waitFor(() => expect(resume).toHaveBeenCalledOnce());
  });

  it('validates payloads like the real host', () => {
    const host = createMockHost(quiet);
    const got = vi.fn();
    host.onMessage(got);
    host.send({ ns: 'croffle-play', v: 1, kind: 'req', id: '9', type: 'save', payload: {} }, '*');
    return vi.waitFor(() =>
      expect(got).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({ code: 'invalid_request' }),
        }),
        'mock://croffle-play',
      ),
    );
  });
});
