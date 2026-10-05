import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import {
  type ClientMessage,
  clientMessageSchema,
  parseRoomsMessage,
  ROOMS,
  ROOMS_CLOSE,
  type ServerMessage,
} from '@croffledev/play-protocol';
import { type WebSocket, WebSocketServer } from 'ws';

import type { VerifyToken } from './auth.js';
import { allowedOrigin } from './config.js';
import { type Member, RoomRegistry } from './registry.js';

export interface RoomsServerOptions {
  verify: VerifyToken;
  /** `https://{id}.play.croffle-play.link` — the Origin a game frame must have. */
  originTemplate: string;
  /** Server-side liveness ping (dead connections are dropped). */
  heartbeatMs?: number;
}

export interface RoomsServer {
  http: Server;
  close(): Promise<void>;
}

/** Shared rooms server: authenticate (first message), join a room, relay. Nothing is persisted. */
export function createRoomsServer(opts: RoomsServerOptions): RoomsServer {
  const registry = new RoomRegistry();
  const http = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({ status: 'ok', rooms: registry.size, connections: wss.clients.size }),
      );
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ server: http, maxPayload: ROOMS.maxMessageBytes });
  const alive = new WeakMap<WebSocket, boolean>();

  wss.on('connection', (ws, req) => {
    const origin = req.headers.origin;
    const bucket = tokenBucket(ROOMS.messagesPerSecond, ROOMS.messagesPerSecond * 2);
    let member: Member | null = null;
    let authenticating = false;
    const authTimer = setTimeout(
      () => ws.close(ROOMS_CLOSE.authTimeout, 'auth timeout'),
      ROOMS.authTimeoutMs,
    );
    const send = (m: ServerMessage) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(m));
      }
    };
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    // Protocol violations (e.g. oversized frames) surface here; ws then closes the socket itself.
    ws.on('error', () => undefined);

    ws.on('message', (raw, isBinary) => {
      if (!bucket()) {
        ws.close(ROOMS_CLOSE.rateLimited, 'rate limited');
        return;
      }
      const msg = isBinary ? null : parseRoomsMessage(clientMessageSchema, raw.toString());
      if (!msg) {
        ws.close(ROOMS_CLOSE.protocolError, 'invalid message');
        return;
      }
      if (member) {
        handle(member, msg);
        return;
      }
      if (msg.t !== 'auth') {
        ws.close(ROOMS_CLOSE.protocolError, 'auth first');
        return;
      }
      if (authenticating) {
        return;
      }
      authenticating = true;
      void opts.verify(msg.token).then((id) => {
        if (!id) {
          ws.close(ROOMS_CLOSE.authFailed, 'invalid token');
          return;
        }
        // The token says which game this is; the browser-set Origin must be that game's domain.
        if (origin !== allowedOrigin(opts.originTemplate, id.gameId)) {
          ws.close(ROOMS_CLOSE.originRejected, 'origin not allowed');
          return;
        }
        clearTimeout(authTimer);
        member = {
          peer: { id: randomUUID(), userId: id.userId, nickname: id.nickname },
          gameId: id.gameId,
          room: null,
          send,
        };
        send({ t: 'welcome', self: member.peer });
      });
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (member) {
        registry.leave(member);
      }
    });
  });

  function handle(m: Member, msg: ClientMessage) {
    switch (msg.t) {
      case 'auth':
        m.send({ t: 'error', code: 'already_authenticated', message: 'Already authenticated' });
        return;
      case 'join': {
        const r = registry.join(m, msg.room, msg.maxPeers);
        if (typeof r === 'string') {
          m.send({
            t: 'error',
            code: r,
            message: r === 'room_full' ? 'Room is full' : 'Leave first',
          });
        }
        return;
      }
      case 'leave':
        registry.leave(m);
        return;
      case 'send':
        if (!registry.relay(m, msg.data, msg.to)) {
          m.send({
            t: 'error',
            code: m.room ? 'unknown_peer' : 'not_in_room',
            message: 'Not delivered',
          });
        }
        return;
      case 'ping':
        m.send({ t: 'pong' });
    }
  }

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, opts.heartbeatMs ?? ROOMS.pingIntervalMs);

  return {
    http,
    close: () =>
      new Promise((resolve) => {
        clearInterval(heartbeat);
        for (const ws of wss.clients) {
          ws.close(ROOMS_CLOSE.serverShutdown, 'server shutting down');
        }
        wss.close(() => http.close(() => resolve()));
        // Do not wait forever for clients that never acknowledge the close.
        setTimeout(() => {
          for (const ws of wss.clients) {
            ws.terminate();
          }
        }, 2000).unref();
      }),
  };
}

/** Token bucket: `rate` per second, up to `burst`. Returns a take() that is false when empty. */
function tokenBucket(rate: number, burst: number): () => boolean {
  let tokens = burst;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(burst, tokens + ((now - last) / 1000) * rate);
    last = now;
    if (tokens < 1) {
      return false;
    }
    tokens -= 1;
    return true;
  };
}
