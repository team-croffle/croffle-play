/**
 * Wire format between games and the shared rooms server (WebSocket, JSON text frames). The game
 * connects directly; the shell is not in the path (docs/ARCHITECTURE.md §6).
 *
 * After connecting, the first message must be `auth` (never a token in the URL). The server relays
 * messages within a room; game logic runs on the clients, with one peer acting as host.
 */
import * as v from 'valibot';

export const ROOMS = {
  /** Clients ping this often; Cloudflare drops connections idle for ~100 s. */
  pingIntervalMs: 30_000,
  /** Connections that do not authenticate within this time are closed. */
  authTimeoutMs: 5_000,
  /** Largest frame, in UTF-8 bytes of the JSON text. */
  maxMessageBytes: 16 * 1024,
  defaultMaxPeers: 8,
  maxPeers: 16,
  /** Messages per second per connection (burst = 2×). */
  messagesPerSecond: 30,
} as const;

/** WebSocket close codes used by the rooms server (4000–4999 are application codes). */
export const ROOMS_CLOSE = {
  authFailed: 4001,
  authTimeout: 4002,
  originRejected: 4003,
  protocolError: 4004,
  rateLimited: 4008,
  serverShutdown: 4009,
} as const;

/** Codes after which a client must not reconnect on its own. */
export const ROOMS_FATAL_CLOSE: readonly number[] = [
  ROOMS_CLOSE.authFailed,
  ROOMS_CLOSE.originRejected,
  ROOMS_CLOSE.protocolError,
];

export const roomIdSchema = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]{0,31}$/));

export const peerSchema = v.object({
  /** Connection id (one player may have several tabs). */
  id: v.string(),
  /** Public account id. */
  userId: v.string(),
  nickname: v.string(),
});
export type Peer = v.InferOutput<typeof peerSchema>;

export const clientMessageSchema = v.variant('t', [
  v.object({ t: v.literal('auth'), token: v.pipe(v.string(), v.maxLength(4096)) }),
  v.object({
    t: v.literal('join'),
    /** Omit to create a new room with a server-chosen id. */
    room: v.optional(roomIdSchema),
    maxPeers: v.optional(
      v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(ROOMS.maxPeers)),
    ),
  }),
  v.object({ t: v.literal('leave') }),
  v.object({ t: v.literal('send'), data: v.unknown(), to: v.optional(v.string()) }),
  v.object({ t: v.literal('ping') }),
]);
export type ClientMessage = v.InferOutput<typeof clientMessageSchema>;

export const serverMessageSchema = v.variant('t', [
  v.object({ t: v.literal('welcome'), self: peerSchema }),
  v.object({
    t: v.literal('joined'),
    room: roomIdSchema,
    peers: v.array(peerSchema),
    host: v.string(),
  }),
  v.object({ t: v.literal('peer-join'), peer: peerSchema }),
  v.object({ t: v.literal('peer-leave'), peerId: v.string() }),
  v.object({ t: v.literal('host'), peerId: v.string() }),
  v.object({ t: v.literal('msg'), from: v.string(), data: v.unknown() }),
  v.object({ t: v.literal('pong') }),
  v.object({ t: v.literal('error'), code: v.string(), message: v.string() }),
]);
export type ServerMessage = v.InferOutput<typeof serverMessageSchema>;

/** Parses one frame; null when it is not valid JSON or not a known message. */
export function parseRoomsMessage<
  S extends typeof clientMessageSchema | typeof serverMessageSchema,
>(schema: S, text: string): v.InferOutput<S> | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const r = v.safeParse(schema, json);
  return r.success ? r.output : null;
}
