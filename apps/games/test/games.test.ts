import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { filePath, gameIdFromHost } from '../src/host.js';
import { createGameHost } from '../src/server.js';
import type { ReadStore, StoredFile } from '../src/store.js';

const TEMPLATE = 'https://{id}.play.test';
const DEPLOY = '11111111-1111-4111-8111-111111111111';
const OLD = '22222222-2222-4222-8222-222222222222';

class FakeStore implements ReadStore {
  readonly objects = new Map<string, StoredFile>();
  reads = 0;

  put(key: string, text: string, contentType = 'text/plain') {
    this.objects.set(key, { body: new TextEncoder().encode(text), contentType, etag: null });
  }

  async get(key: string): Promise<StoredFile | null> {
    this.reads += 1;
    return this.objects.get(key) ?? null;
  }
}

describe('host → game id', () => {
  it.each([
    ['tetris.play.test', 'tetris'],
    ['TETRIS.play.test', 'tetris'],
    ['tetris.play.test:443', 'tetris'],
    ['play.test', null],
    ['api.play.test', null], // reserved
    ['a.b.play.test', null],
    ['tetris.play.evil', null],
    ['tetris.play.test:8443', null],
    ['Bad_Id.play.test', null],
    [undefined, null],
  ])('%s → %s', (host, id) => {
    expect(gameIdFromHost(TEMPLATE, host)).toBe(id);
  });

  it('keeps an explicit port in the template', () => {
    expect(gameIdFromHost('http://{id}.localhost:4100', 'duo.localhost:4100')).toBe('duo');
    expect(gameIdFromHost('http://{id}.localhost:4100', 'duo.localhost')).toBeNull();
  });
});

describe('request path → file', () => {
  it.each([
    ['/', 'play.html'],
    ['/assets/a.js', 'assets/a.js'],
    ['/dir/', 'dir/index.html'],
    ['/a/../b.js', null],
    ['/%2e%2e/x', null],
    ['/a%2fb', null],
    ['/a%5cb', null],
    ['/%zz', null],
  ])('%s → %s', (pathname, file) => {
    expect(filePath(pathname, 'play.html')).toBe(file);
  });
});

describe('game host', () => {
  const store = new FakeStore();
  const server = createGameHost({
    store,
    originTemplate: TEMPLATE,
    portalOrigin: 'https://game.test',
    pointerTtlMs: 50,
    fileMaxAgeSeconds: 120,
  });
  let base = '';

  beforeAll(async () => {
    store.put(
      'games/tetris/current.json',
      JSON.stringify({ deployId: DEPLOY, entry: 'play.html' }),
    );
    store.put(`games/tetris/${DEPLOY}/play.html`, '<h1>tetris</h1>', 'text/html; charset=utf-8');
    store.put(`games/tetris/${DEPLOY}/game.json`, '{"id":"tetris"}', 'application/json');
    store.put(`games/tetris/${DEPLOY}/a/b.js`, 'js', 'text/javascript');
    store.put(`games/tetris/${OLD}/play.html`, 'old');
    store.put(`games/other/${DEPLOY}/secret.txt`, 'secret');
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  // `fetch` drops a custom Host header, so talk HTTP directly.
  const request = (
    path: string,
    host = 'tetris.play.test',
    headers: Record<string, string> = {},
    method = 'GET',
  ) =>
    new Promise<{ status: number; headers: Record<string, string>; text: string }>(
      (resolve, reject) => {
        const req = httpRequest(
          `${base}${path}`,
          { method, headers: { host, ...headers } },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () =>
              resolve({
                status: res.statusCode ?? 0,
                headers: Object.fromEntries(
                  Object.entries(res.headers).map(([k, v]) => [k, String(v ?? '')]),
                ),
                text: Buffer.concat(chunks).toString(),
              }),
            );
          },
        );
        req.on('error', reject);
        req.end();
      },
    );
  const get = request;

  it('serves the entry at / with the platform headers', async () => {
    const res = await get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('<h1>tetris</h1>');
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.headers['content-security-policy']).toBe('frame-ancestors https://game.test');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('caches other files briefly and answers 304 to a matching ETag', async () => {
    const res = await get('/a/b.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=120');
    const etag = res.headers['etag'] ?? '';
    expect(etag).not.toBe('');
    const again = await get('/a/b.js', 'tetris.play.test', { 'if-none-match': etag });
    expect(again.status).toBe(304);
    const head = await request('/a/b.js', 'tetris.play.test', {}, 'HEAD');
    expect(head.status).toBe(200);
    expect(head.text).toBe('');
  });

  it('never reaches another game or another deploy of the same game', async () => {
    expect((await get('/secret.txt')).status).toBe(404);
    expect((await get(`/../${OLD}/play.html`)).status).toBe(404);
    expect((await get('/%2e%2e/other/secret.txt')).status).toBe(404);
    expect((await get('/play.html', 'other.play.test')).status).toBe(404); // no pointer
    expect((await get('/play.html', 'api.play.test')).status).toBe(404); // reserved id
    expect((await get('/play.html', 'tetris.play.evil')).status).toBe(404);
  });

  it('follows the pointer when it changes, within the TTL', async () => {
    store.put('games/tetris/current.json', JSON.stringify({ deployId: OLD, entry: 'play.html' }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await get('/')).text).toBe('old');
    store.put(
      'games/tetris/current.json',
      JSON.stringify({ deployId: DEPLOY, entry: 'play.html' }),
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await get('/')).text).toBe('<h1>tetris</h1>');
  });

  it('refuses other methods and answers /healthz on the bare host only', async () => {
    const post = await request('/', 'tetris.play.test', {}, 'POST');
    expect(post.status).toBe(405);
    const health = await get('/healthz', 'play.test');
    expect(health.status).toBe(200);
    expect((JSON.parse(health.text) as { status: string }).status).toBe('ok');
    expect((await get('/healthz')).status).toBe(404); // a game's /healthz is just a file
  });
});
