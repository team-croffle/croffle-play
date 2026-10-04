import {
  type ClientMessage,
  type Peer,
  parseRoomsMessage,
  ROOMS,
  ROOMS_FATAL_CLOSE,
  type ServerMessage,
  serverMessageSchema,
} from '@croffledev/play-protocol';

import { SdkError } from './errors.js';

/** Minimal WebSocket surface (browser WebSocket; injectable for tests). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open' | 'error', listener: () => void): void;
  addEventListener(type: 'message', listener: (ev: { data: unknown }) => void): void;
  addEventListener(type: 'close', listener: (ev: { code: number; reason: string }) => void): void;
}
export type SocketFactory = (url: string) => SocketLike;

export interface RoomEvents {
  message: (data: unknown, from: string) => void;
  'peer-join': (peer: Peer) => void;
  'peer-leave': (peerId: string) => void;
  host: (peerId: string) => void;
  /** Connection lost; the SDK is reconnecting (`attempt` starts at 1). */
  reconnecting: (attempt: number) => void;
  /** Back in the same room (with a new `self.id`). */
  reconnected: () => void;
  /** Gone for good (left, refused, or the room could not be re-joined). */
  closed: (reason: string) => void;
}

interface RoomDeps {
  url: () => Promise<string>;
  token: () => Promise<string>;
  socket: SocketFactory;
  /** For tests: deterministic jitter. */
  random?: () => number;
}

const OPEN = 1;

/**
 * A joined room on the shared rooms server. Keeps the connection alive (30 s ping) and, when it
 * drops, reconnects with exponential backoff and re-joins the same room with a fresh token.
 */
export class Room {
  id = '';
  self!: Peer;
  host = '';
  readonly peers = new Map<string, Peer>();
  private ws: SocketLike | null = null;
  private readonly listeners = new Map<keyof RoomEvents, Set<(...args: never[]) => void>>();
  private ping: ReturnType<typeof setInterval> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;
  private left = false;

  private constructor(
    private readonly deps: RoomDeps,
    private readonly maxPeers: number | undefined,
  ) {}

  /** Connects and joins (`room` omitted: the server creates one; share `room.id`). */
  static async join(deps: RoomDeps, room?: string, maxPeers?: number): Promise<Room> {
    const r = new Room(deps, maxPeers);
    r.id = room ?? '';
    await r.connect();
    return r;
  }

  get isHost(): boolean {
    return this.host === this.self.id;
  }

  /** To everyone else in the room, or to one peer. Dropped while reconnecting. */
  send(data: unknown, to?: string): void {
    this.write({ t: 'send', data, ...(to === undefined ? {} : { to }) });
  }

  on<E extends keyof RoomEvents>(event: E, listener: RoomEvents[E]): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (...args: never[]) => void);
    return () => set.delete(listener as (...args: never[]) => void);
  }

  leave(): void {
    if (this.left) {
      return;
    }
    this.left = true;
    this.write({ t: 'leave' });
    this.teardown();
    this.ws?.close(1000, 'left');
    this.emit('closed', 'left');
  }

  /** One connection attempt: resolves once joined, rejects if it ends before that. */
  private async connect(): Promise<void> {
    const [url, token] = await Promise.all([this.deps.url(), this.deps.token()]);
    const ws = this.deps.socket(url);
    this.ws = ws;
    return new Promise((resolve, reject) => {
      let joined = false;
      ws.addEventListener('open', () => this.write({ t: 'auth', token }));
      ws.addEventListener('error', () => undefined);
      ws.addEventListener('message', (ev) => {
        const msg =
          typeof ev.data === 'string' ? parseRoomsMessage(serverMessageSchema, ev.data) : null;
        if (msg?.t === 'welcome') {
          this.self = msg.self;
          this.write({
            t: 'join',
            ...(this.id ? { room: this.id } : {}),
            ...(this.maxPeers ? { maxPeers: this.maxPeers } : {}),
          });
        } else if (msg?.t === 'joined') {
          joined = true;
          this.onJoined(msg);
          resolve();
        } else if (msg?.t === 'error' && !joined) {
          reject(new SdkError(msg.code, msg.message));
          ws.close(1000, msg.code);
        } else if (msg) {
          this.dispatch(msg);
        }
      });
      ws.addEventListener('close', (ev) => {
        this.teardown();
        if (!joined) {
          reject(new SdkError('unavailable', `Rooms connection closed (${ev.code} ${ev.reason})`));
        }
        this.onClosed(ev, joined);
      });
    });
  }

  private onClosed(ev: { code: number; reason: string }, wasJoined: boolean) {
    if (this.left) {
      return;
    }
    if (wasJoined && ROOMS_FATAL_CLOSE.includes(ev.code)) {
      this.left = true;
      this.emit('closed', ev.reason || `closed (${ev.code})`);
      return;
    }
    // A failed first attempt is reported to joinRoom(); later failures keep retrying.
    if (wasJoined || this.attempt > 0) {
      this.scheduleReconnect();
    }
  }

  private onJoined(msg: Extract<ServerMessage, { t: 'joined' }>) {
    this.id = msg.room;
    this.host = msg.host;
    this.peers.clear();
    for (const p of msg.peers) {
      this.peers.set(p.id, p);
    }
    this.ping = setInterval(() => this.write({ t: 'ping' }), ROOMS.pingIntervalMs);
    if (this.attempt > 0) {
      this.attempt = 0;
      this.emit('reconnected');
    }
  }

  private dispatch(msg: ServerMessage) {
    switch (msg.t) {
      case 'pong':
      case 'error':
      case 'welcome':
      case 'joined':
        return;
      case 'peer-join':
        this.peers.set(msg.peer.id, msg.peer);
        this.emit('peer-join', msg.peer);
        return;
      case 'peer-leave':
        this.peers.delete(msg.peerId);
        this.emit('peer-leave', msg.peerId);
        return;
      case 'host':
        this.host = msg.peerId;
        this.emit('host', msg.peerId);
        return;
      case 'msg':
        this.emit('message', msg.data, msg.from);
    }
  }

  private scheduleReconnect() {
    this.attempt++;
    this.emit('reconnecting', this.attempt);
    const base = Math.min(30_000, 500 * 2 ** (this.attempt - 1));
    const delay = base * (0.5 + (this.deps.random ?? Math.random)() / 2);
    this.retry = setTimeout(() => {
      this.connect().catch((err: unknown) => {
        // `unavailable`: the socket closed again and onClosed() already scheduled the next try.
        // Anything else (no token any more, room full) cannot be fixed by retrying.
        if (!(err instanceof SdkError && err.code === 'unavailable') && !this.left) {
          this.left = true;
          this.emit('closed', err instanceof Error ? err.message : String(err));
        }
      });
    }, delay);
  }

  private teardown() {
    clearInterval(this.ping);
    clearTimeout(this.retry);
  }

  private write(m: ClientMessage) {
    if (this.ws?.readyState === OPEN) {
      this.ws.send(JSON.stringify(m));
    }
  }

  private emit<E extends keyof RoomEvents>(event: E, ...args: Parameters<RoomEvents[E]>) {
    for (const l of this.listeners.get(event) ?? []) {
      (l as (...a: Parameters<RoomEvents[E]>) => void)(...args);
    }
  }
}
