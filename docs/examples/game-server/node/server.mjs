// Minimal authoritative game server for Croffle Play (Tier 2): verifies players with the
// platform's game tokens and owns the game state (here: a shared counter).
//
// Environment (set by the platform's compose fragment):
//   GAME_ID, PORT, PROTOCOL_VERSION, PLATFORM_JWKS_URL, TOKEN_ISSUER, TOKEN_AUDIENCE
//   ALLOWED_ORIGIN (default https://<GAME_ID>.play.croffle-play.link)
import { createServer } from 'node:http';

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { WebSocketServer } from 'ws';

const env = process.env;
const port = Number(env.PORT ?? 8080);
const protocol = env.PROTOCOL_VERSION ?? '1.0.0';
const allowedOrigin = env.ALLOWED_ORIGIN ?? `https://${env.GAME_ID}.play.croffle-play.link`;
const jwks = createRemoteJWKSet(new URL(env.PLATFORM_JWKS_URL));

/** The token's player, or null. Checks signature, issuer, audience (`game:<id>`), and expiry. */
async function verify(token) {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.TOKEN_ISSUER,
      audience: env.TOKEN_AUDIENCE,
    });
    return { userId: payload.sub, nickname: payload.nickname };
  } catch {
    return null;
  }
}

const http = createServer((req, res) => {
  // Clients check compatibility before connecting.
  if (req.url === '/protocol') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ protocol }));
    return;
  }
  res.writeHead(req.url === '/healthz' ? 200 : 404).end();
});

let count = 0;
const players = new Set();
const wss = new WebSocketServer({ server: http, maxPayload: 4096 });

wss.on('connection', (ws, req) => {
  if (req.headers.origin !== allowedOrigin) {
    ws.close(4003, 'origin not allowed');
    return;
  }
  // The token arrives as the first message — never in the URL.
  const timeout = setTimeout(() => ws.close(4002, 'auth timeout'), 5000);
  let player = null;
  ws.on('error', () => undefined);
  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      ws.close(4004, 'invalid message');
      return;
    }
    if (!player) {
      player = msg.t === 'auth' ? await verify(msg.token) : null;
      if (!player) {
        ws.close(4001, 'invalid token');
        return;
      }
      clearTimeout(timeout);
      players.add(ws);
      ws.send(JSON.stringify({ t: 'welcome', you: player, count }));
      return;
    }
    if (msg.t === 'inc') {
      count++;
      const state = JSON.stringify({ t: 'state', count, by: player.nickname });
      for (const p of players) {
        p.send(state);
      }
    }
  });
  ws.on('close', () => {
    clearTimeout(timeout);
    players.delete(ws);
  });
});

http.listen(port, () =>
  console.log(`game server ${env.GAME_ID} on :${port} (protocol ${protocol})`),
);
