import { fail, ok } from '@croffledev/play-protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSdk, SdkError } from '../src/index.js';
import { fakeHost } from './support/fake-host.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('createSdk', () => {
  it('handshakes and exposes capabilities', async () => {
    const host = fakeHost({ capabilities: ['score', 'user'] });
    const sdk = await createSdk({ game: 'tetris', transport: host.transport });
    expect(sdk.has('score')).toBe(true);
    expect(sdk.has('save')).toBe(false);
    expect(host.sent[0]).toEqual({
      message: { type: '__hello', sdk: expect.any(String), game: 'tetris' },
      targetOrigin: '*',
    });
  });

  it('times out without a welcome', async () => {
    vi.useFakeTimers();
    const host = fakeHost({ silent: true });
    const p = createSdk({ game: 'x', transport: host.transport, handshakeTimeoutMs: 1000 });
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    // __hello was retried while waiting.
    expect(host.sent.length).toBeGreaterThan(1);
  });

  it('refuses to run outside a frame without a transport', async () => {
    await expect(createSdk({ game: 'x' })).rejects.toBeInstanceOf(SdkError);
  });
});

describe('requests', () => {
  it('round-trips a typed request to the pinned origin', async () => {
    const host = fakeHost({
      capabilities: ['score'],
      handlers: { submitScore: (req) => ok(req.id, { accepted: true }) },
    });
    const sdk = await createSdk({ game: 'x', transport: host.transport });
    await expect(sdk.submitScore(42)).resolves.toEqual({ accepted: true });
    expect(host.sent.at(-1)).toMatchObject({
      message: { kind: 'req', type: 'submitScore', payload: { score: 42 } },
      targetOrigin: 'https://play.test',
    });
  });

  it('rejects host errors with their code', async () => {
    const host = fakeHost({
      capabilities: ['save'],
      handlers: { save: (req) => fail(req.id, { code: 'auth_required', message: 'sign in' }) },
    });
    const sdk = await createSdk({ game: 'x', transport: host.transport });
    await expect(sdk.save('main', '{}')).rejects.toMatchObject({ code: 'auth_required' });
  });

  it('refuses unsupported and invalid requests locally', async () => {
    const host = fakeHost({ capabilities: ['save'] });
    const sdk = await createSdk({ game: 'x', transport: host.transport });
    await expect(sdk.submitScore(1)).rejects.toMatchObject({ code: 'unsupported' });
    await expect(sdk.save('Not A Slot', '')).rejects.toMatchObject({ code: 'invalid_request' });
  });

  it('times out a request and ignores the late answer', async () => {
    const host = fakeHost({ capabilities: [], handlers: { ready: () => 'no-reply' } });
    const sdk = await createSdk({ game: 'x', transport: host.transport, timeoutMs: 1000 });
    vi.useFakeTimers();
    const p = sdk.ready();
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    host.deliver(ok('1'));
  });

  it('ignores messages from other origins after the handshake', async () => {
    const host = fakeHost({ capabilities: [], handlers: { ready: () => 'no-reply' } });
    const sdk = await createSdk({ game: 'x', transport: host.transport, timeoutMs: 50 });
    const p = sdk.ready();
    host.deliver(ok('1'), 'https://evil.test');
    await expect(p).rejects.toMatchObject({ code: 'timeout' });
  });
});

describe('events', () => {
  it('delivers pause and resume until unsubscribed', async () => {
    const host = fakeHost({});
    const sdk = await createSdk({ game: 'x', transport: host.transport });
    const pause = vi.fn();
    const off = sdk.on('pause', pause);
    host.emit('pause');
    off();
    host.emit('pause');
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
