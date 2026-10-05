import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { checkGame, frameAncestors } from '../src/check.js';

/** A local game host: `tetris.localhost` serves game.json; headers per test. */
let server: Server;
let port: number;
let headers: Record<string, string> = {};
let manifest: unknown = { id: 'tetris', name: 'Tetris', sdk: '^1.0.0' };

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/game.json') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(manifest));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html', ...headers }).end('<!doctype html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const portal = 'https://game.croffle-play.link';
// Every request goes to the local server; the URL keeps the game host name.
const local: typeof fetch = (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  return fetch(`http://127.0.0.1:${port}${url.pathname}`, init);
};
const check = (url: string, opts = {}) =>
  checkGame(url, { portal, insecure: true, fetch: local, ...opts });

describe('checkGame', () => {
  it('accepts a game that lets the portal frame it', async () => {
    headers = { 'content-security-policy': `frame-ancestors ${portal}` };
    const r = await check('http://tetris.localhost/index.html');
    expect(r).toMatchObject({ ok: true, errors: [], warnings: [] });
    expect(r.manifest?.id).toBe('tetris');
  });

  it('accepts wildcard and scheme sources', async () => {
    headers = {
      'content-security-policy': "default-src 'self'; frame-ancestors https://*.croffle-play.link",
    };
    expect((await check('http://tetris.localhost/')).ok).toBe(true);
    headers = { 'content-security-policy': 'frame-ancestors https:' };
    expect((await check('http://tetris.localhost/')).ok).toBe(true);
  });

  it('refuses frame-ancestors without the portal, and X-Frame-Options DENY', async () => {
    headers = { 'content-security-policy': "frame-ancestors 'self'" };
    expect((await check('http://tetris.localhost/')).errors[0]).toMatch(
      /does not allow the portal/,
    );
    headers = { 'x-frame-options': 'DENY' };
    expect((await check('http://tetris.localhost/')).errors[0]).toMatch(/X-Frame-Options DENY/);
  });

  it('warns when nothing restricts framing', async () => {
    headers = {};
    const r = await check('http://tetris.localhost/');
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toMatch(/any site can frame the game/);
  });

  it('requires https unless --insecure, and an id matching the host', async () => {
    headers = { 'content-security-policy': `frame-ancestors ${portal}` };
    expect((await check('http://tetris.localhost/', { insecure: false })).errors[0]).toMatch(
      /not https/,
    );
    expect((await check('http://other.localhost/')).errors[0]).toMatch(
      /does not match the host 'other.localhost'/,
    );
  });

  it('reports an invalid game.json', async () => {
    manifest = { id: 'tetris' };
    expect((await check('http://tetris.localhost/')).errors.join()).toMatch(/game.json name/);
    manifest = { id: 'tetris', name: 'Tetris', sdk: '^1.0.0' };
  });
});

describe('frameAncestors', () => {
  it('finds the directive across policies', () => {
    expect(frameAncestors("default-src 'self', frame-ancestors a b")).toEqual(['a', 'b']);
    expect(frameAncestors("default-src 'self'")).toBeNull();
    expect(frameAncestors(null)).toBeNull();
  });
});
