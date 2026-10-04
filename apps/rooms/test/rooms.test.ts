import { ROOMS_CLOSE } from '@croffledev/play-protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connect, player, startServer, token } from './support.js';

let url: string;
let port: number;
let close: () => Promise<void>;

beforeAll(async () => {
  const s = await startServer();
  url = s.url;
  port = s.port;
  close = () => s.server.close();
});

afterAll(async () => {
  await close();
});

describe('authentication', () => {
  it('welcomes a valid token from the matching game origin', async () => {
    const c = await connect(url);
    c.send({ t: 'auth', token: await token('u1') });
    expect(await c.next('welcome')).toMatchObject({ self: { userId: 'u1', nickname: 'nick-u1' } });
    c.ws.close();
  });

  it.each([
    ['a forged or foreign token', { aud: 'api' }, 'https://duo.games.test', ROOMS_CLOSE.authFailed],
    [
      'a token from another issuer',
      { iss: 'https://evil.test' },
      'https://duo.games.test',
      ROOMS_CLOSE.authFailed,
    ],
    ['an expired token', { exp: '-1m' }, 'https://duo.games.test', ROOMS_CLOSE.authFailed],
    ["another game's origin", {}, 'https://other.games.test', ROOMS_CLOSE.originRejected],
    ['no origin', {}, null, ROOMS_CLOSE.originRejected],
  ] as const)('closes on %s', async (_name, opts, origin, code) => {
    const c = await connect(url, origin);
    c.send({ t: 'auth', token: await token('u1', 'duo', opts) });
    expect((await c.closed).code).toBe(code);
  });

  it('requires auth first', async () => {
    const c = await connect(url);
    c.send({ t: 'join', room: 'x' });
    expect((await c.closed).code).toBe(ROOMS_CLOSE.protocolError);
  });

  it('closes connections that never authenticate', async () => {
    const c = await connect(url);
    expect((await c.closed).code).toBe(ROOMS_CLOSE.authTimeout);
  }, 10_000);
});

describe('rooms', () => {
  it('joins, relays, and hands over the host', async () => {
    const a = await player(url, 'a');
    const b = await player(url, 'b');
    a.send({ t: 'join', room: 'lobby' });
    const joinedA = await a.next('joined');
    const hostId = joinedA.host;
    b.send({ t: 'join', room: 'lobby' });
    expect(await b.next('joined')).toMatchObject({ room: 'lobby', host: hostId });
    expect(await a.next('peer-join')).toMatchObject({ peer: { userId: 'b' } });

    a.send({ t: 'send', data: { move: 3 } });
    expect(await b.next('msg')).toMatchObject({ from: hostId, data: { move: 3 } });

    a.ws.close();
    expect(await b.next('peer-leave')).toMatchObject({ peerId: hostId });
    expect((await b.next('host')).peerId).not.toBe(hostId);
    b.ws.close();
  });

  it('keeps games apart even with the same room name', async () => {
    const a = await player(url, 'a', 'duo');
    const b = await player(url, 'b', 'other');
    a.send({ t: 'join', room: 'lobby' });
    b.send({ t: 'join', room: 'lobby' });
    expect((await a.next('joined')).peers).toHaveLength(1);
    expect((await b.next('joined')).peers).toHaveLength(1);
    a.ws.close();
    b.ws.close();
  });

  it('creates a room with a server id, enforces max peers, and sends to one peer', async () => {
    const a = await player(url, 'a');
    a.send({ t: 'join', maxPeers: 2 });
    const room = (await a.next('joined')).room as string;
    expect(room).toMatch(/^[a-z0-9-]+$/);
    const b = await player(url, 'b');
    const c = await player(url, 'c');
    b.send({ t: 'join', room });
    const bSelf = (await b.next('joined')).peers as { id: string; userId: string }[];
    c.send({ t: 'join', room });
    expect(await c.next('error')).toMatchObject({ code: 'room_full' });
    a.send({ t: 'send', to: bSelf.find((p) => p.userId === 'b')?.id, data: 'psst' });
    expect(await b.next('msg')).toMatchObject({ data: 'psst' });
    for (const x of [a, b, c]) {
      x.ws.close();
    }
  });

  it('answers ping, refuses sends outside a room, and drops oversized frames', async () => {
    const a = await player(url, 'a');
    a.send({ t: 'ping' });
    await a.next('pong');
    a.send({ t: 'send', data: 1 });
    expect(await a.next('error')).toMatchObject({ code: 'not_in_room' });
    a.send({ t: 'send', data: 'x'.repeat(20_000) });
    expect((await a.closed).code).toBe(1009);
  });

  it('closes floods', async () => {
    const a = await player(url, 'a');
    for (let i = 0; i < 200; i++) {
      a.send({ t: 'ping' });
    }
    expect((await a.closed).code).toBe(ROOMS_CLOSE.rateLimited);
  });

  it('reports health', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(await res.json()).toMatchObject({ status: 'ok' });
  });
});
