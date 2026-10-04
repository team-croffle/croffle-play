import type { AddressInfo } from 'node:net';

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { WebSocket } from 'ws';

import { tokenVerifier } from '../src/auth.js';
import { createRoomsServer, type RoomsServer } from '../src/server.js';

const ISSUER = 'https://api.test';
const keys = await generateKeyPair('ES256');
const jwks = createLocalJWKSet({
  keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'k', alg: 'ES256' }],
});

export const ORIGIN_TEMPLATE = 'https://{id}.games.test';

export function token(
  userId: string,
  game = 'duo',
  opts: { aud?: string; iss?: string; exp?: string } = {},
) {
  return new SignJWT({ nickname: `nick-${userId}` })
    .setProtectedHeader({ alg: 'ES256', kid: 'k' })
    .setIssuer(opts.iss ?? ISSUER)
    .setSubject(userId)
    .setAudience(opts.aud ?? `game:${game}`)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '10m')
    .sign(keys.privateKey);
}

export async function startServer(opts: { heartbeatMs?: number } = {}) {
  const server: RoomsServer = createRoomsServer({
    verify: tokenVerifier(jwks, ISSUER),
    originTemplate: ORIGIN_TEMPLATE,
    ...opts,
  });
  await new Promise<void>((resolve) => server.http.listen(0, '127.0.0.1', resolve));
  const { port } = server.http.address() as AddressInfo;
  return { server, url: `ws://127.0.0.1:${port}`, port };
}

export interface Client {
  ws: WebSocket;
  messages: Record<string, unknown>[];
  send(m: object): void;
  next(t: string, ms?: number): Promise<Record<string, unknown>>;
  closed: Promise<{ code: number; reason: string }>;
}

export async function connect(
  url: string,
  origin: string | null = 'https://duo.games.test',
): Promise<Client> {
  const ws = new WebSocket(url, origin ? { origin } : {});
  const messages: Record<string, unknown>[] = [];
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() })),
  );
  ws.on('error', () => undefined);
  ws.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as Record<string, unknown>));
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  return {
    ws,
    messages,
    closed,
    send: (m) => ws.send(JSON.stringify(m)),
    async next(t, ms = 2000) {
      const start = Date.now();
      while (Date.now() - start < ms) {
        const i = messages.findIndex((m) => m.t === t);
        if (i >= 0) {
          return messages.splice(i, 1)[0] as Record<string, unknown>;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`no '${t}' within ${ms} ms; got ${JSON.stringify(messages)}`);
    },
  };
}

/** Connected, authenticated client. */
export async function player(url: string, userId: string, game = 'duo'): Promise<Client> {
  const c = await connect(url, `https://${game}.games.test`);
  c.send({ t: 'auth', token: await token(userId, game) });
  await c.next('welcome');
  return c;
}
