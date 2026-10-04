import { ROOMS_CLOSE } from '@croffledev/play-protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Room, type SocketLike } from '../src/rooms.js';

/** In-memory rooms server: answers auth/join; tests can push messages or drop the socket. */
class FakeServer {
  sockets: FakeSocket[] = [];
  sent: Record<string, unknown>[] = [];
  refuseJoin: string | null = null;
  private n = 0;

  factory = (url: string): SocketLike => {
    const s = new FakeSocket(url, this);
    this.sockets.push(s);
    queueMicrotask(() => s.open());
    return s;
  };

  receive(s: FakeSocket, m: Record<string, unknown>) {
    this.sent.push(m);
    if (m.t === 'auth') {
      s.push({ t: 'welcome', self: { id: `c${++this.n}`, userId: 'u1', nickname: 'Kim' } });
    } else if (m.t === 'join') {
      if (this.refuseJoin) {
        s.push({ t: 'error', code: this.refuseJoin, message: 'no' });
        return;
      }
      const self = { id: `c${this.n}`, userId: 'u1', nickname: 'Kim' };
      s.push({ t: 'joined', room: (m.room as string) ?? 'auto-1', peers: [self], host: self.id });
    }
  }

  get last(): FakeSocket {
    return this.sockets.at(-1) as FakeSocket;
  }
}

class FakeSocket implements SocketLike {
  readyState = 0;
  private readonly listeners = new Map<string, ((ev: never) => void)[]>();

  constructor(
    readonly url: string,
    private readonly server: FakeServer,
  ) {}

  addEventListener(type: string, listener: (ev: never) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  private fire(type: string, ev: unknown) {
    for (const l of this.listeners.get(type) ?? []) {
      l(ev as never);
    }
  }

  open() {
    this.readyState = 1;
    this.fire('open', {});
  }

  send(data: string) {
    this.server.receive(this, JSON.parse(data) as Record<string, unknown>);
  }

  push(m: object) {
    this.fire('message', { data: JSON.stringify(m) });
  }

  close(code = 1000, reason = '') {
    if (this.readyState === 3) {
      return;
    }
    this.readyState = 3;
    this.fire('close', { code, reason });
  }
}

function deps(server: FakeServer) {
  let tokens = 0;
  return {
    url: async () => 'wss://rooms.test',
    token: async () => `t${++tokens}`,
    socket: (url: string) => server.factory(url),
    random: () => 1,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Room', () => {
  it('authenticates first, then joins and tracks peers and host', async () => {
    const server = new FakeServer();
    const room = await Room.join(deps(server), 'lobby', 4);
    expect(server.sent.slice(0, 2)).toEqual([
      { t: 'auth', token: 't1' },
      { t: 'join', room: 'lobby', maxPeers: 4 },
    ]);
    expect(server.last.url).toBe('wss://rooms.test');
    expect(room.id).toBe('lobby');
    expect(room.isHost).toBe(true);

    const joins = vi.fn();
    const msgs = vi.fn();
    room.on('peer-join', joins);
    room.on('message', msgs);
    server.last.push({ t: 'peer-join', peer: { id: 'c9', userId: 'u2', nickname: 'Lee' } });
    server.last.push({ t: 'host', peerId: 'c9' });
    server.last.push({ t: 'msg', from: 'c9', data: { move: 1 } });
    expect(joins).toHaveBeenCalledWith({ id: 'c9', userId: 'u2', nickname: 'Lee' });
    expect(room.peers.size).toBe(2);
    expect(room.isHost).toBe(false);
    expect(msgs).toHaveBeenCalledWith({ move: 1 }, 'c9');

    room.send('hi', 'c9');
    expect(server.sent.at(-1)).toEqual({ t: 'send', data: 'hi', to: 'c9' });
  });

  it('lets the server pick the room id', async () => {
    const room = await Room.join(deps(new FakeServer()));
    expect(room.id).toBe('auto-1');
  });

  it('rejects when the room cannot be joined', async () => {
    const server = new FakeServer();
    server.refuseJoin = 'room_full';
    await expect(Room.join(deps(server), 'full')).rejects.toMatchObject({ code: 'room_full' });
  });

  it('reconnects with a fresh token and re-joins the same room', async () => {
    const server = new FakeServer();
    const room = await Room.join(deps(server), undefined);
    vi.useFakeTimers();
    const events: string[] = [];
    room.on('reconnecting', (n) => events.push(`reconnecting ${n}`));
    room.on('reconnected', () => events.push('reconnected'));

    server.last.close(1006, 'network');
    expect(events).toEqual(['reconnecting 1']);
    await vi.advanceTimersByTimeAsync(500);
    await vi.runAllTicks();
    expect(events).toEqual(['reconnecting 1', 'reconnected']);
    expect(server.sent.filter((m) => m.t === 'auth')).toEqual([
      { t: 'auth', token: 't1' },
      { t: 'auth', token: 't2' },
    ]);
    expect(server.sent.findLast((m) => m.t === 'join')).toEqual({ t: 'join', room: 'auto-1' });
  });

  it('backs off exponentially while the server is down', async () => {
    const server = new FakeServer();
    const room = await Room.join(deps(server), 'r');
    vi.useFakeTimers();
    const attempts: number[] = [];
    room.on('reconnecting', (n) => attempts.push(n));
    server.factory = (url) => {
      const s = new FakeSocket(url, server);
      queueMicrotask(() => s.close(1006, 'down'));
      return s;
    };
    server.last.close(1006, 'network');
    for (const ms of [500, 1000, 2000, 4000]) {
      await vi.advanceTimersByTimeAsync(ms);
    }
    expect(attempts).toEqual([1, 2, 3, 4, 5]);
  });

  it('gives up when no fresh token can be had', async () => {
    const server = new FakeServer();
    let signedIn = true;
    const room = await Room.join(
      {
        ...deps(server),
        token: async () => {
          if (!signedIn) {
            throw new Error('auth_required');
          }
          return 't';
        },
      },
      'r',
    );
    vi.useFakeTimers();
    const closed = vi.fn();
    room.on('closed', closed);
    signedIn = false;
    server.last.close(1006, 'network');
    await vi.advanceTimersByTimeAsync(500);
    expect(closed).toHaveBeenCalledWith('auth_required');
  });

  it('stops on fatal close codes and on leave', async () => {
    const server = new FakeServer();
    const room = await Room.join(deps(server), 'r');
    const closed = vi.fn();
    room.on('closed', closed);
    server.last.close(ROOMS_CLOSE.authFailed, 'invalid token');
    expect(closed).toHaveBeenCalledWith('invalid token');

    const room2 = await Room.join(deps(server), 'r');
    const reconnecting = vi.fn();
    room2.on('reconnecting', reconnecting);
    room2.leave();
    expect(server.sent.at(-1)).toEqual({ t: 'leave' });
    expect(reconnecting).not.toHaveBeenCalled();
  });

  it('pings every 30 seconds', async () => {
    vi.useFakeTimers();
    const server = new FakeServer();
    const p = Room.join(deps(server), 'r');
    await vi.advanceTimersByTimeAsync(0);
    await p;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(server.sent.filter((m) => m.t === 'ping')).toHaveLength(2);
  });
});
