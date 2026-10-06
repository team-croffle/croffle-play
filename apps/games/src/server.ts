import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { ByteCache, Ttl } from './cache.js';
import { filePath, gameIdFromHost } from './host.js';
import type { ReadStore, StoredFile } from './store.js';

export interface GameHostOptions {
  store: ReadStore;
  /** `https://{id}.play.croffle-play.link` */
  originTemplate: string;
  /** The portal, allowed to frame the games. */
  portalOrigin: string;
  pointerTtlMs?: number;
  cacheMaxBytes?: number;
  fileMaxAgeSeconds?: number;
}

interface Pointer {
  deployId: string;
  entry: string;
}

/**
 * Serves the active deploy of each platform-hosted game from storage: `Host` → game id →
 * `games/<id>/current.json` → `games/<id>/<deploy>/<path>`. The platform sets the headers a
 * team would otherwise have to (`frame-ancestors`, `nosniff`); nothing is executed here.
 */
export function createGameHost(opts: GameHostOptions): Server {
  const pointers = new Ttl<Pointer | null>(opts.pointerTtlMs ?? 10_000);
  const files = new ByteCache<StoredFile>(opts.cacheMaxBytes ?? 64 * 1024 * 1024);
  const maxAge = opts.fileMaxAgeSeconds ?? 300;

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return end(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD' });
    }
    const url = new URL(req.url ?? '/', 'http://x');
    if (
      url.pathname === '/healthz' &&
      gameIdFromHost(opts.originTemplate, req.headers.host) === null
    ) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', cached: files.size }));
      return;
    }
    const id = gameIdFromHost(opts.originTemplate, req.headers.host);
    if (!id) {
      return end(res, 404, 'No such game');
    }
    const pointer = await pointers.get(id, () => readPointer(opts.store, id));
    if (!pointer) {
      return end(res, 404, 'This game is not hosted by the platform');
    }
    const path = filePath(url.pathname, pointer.entry);
    if (!path) {
      return end(res, 404, 'Not Found');
    }
    const key = `games/${id}/${pointer.deployId}/${path}`;
    let file = files.get(key);
    if (!file) {
      const loaded = await opts.store.get(key);
      if (!loaded) {
        return end(res, 404, 'Not Found');
      }
      file = loaded;
      files.set(key, file);
    }
    const etag = file.etag ?? `"${createHash('sha1').update(file.body).digest('hex')}"`;
    const isDocument = path === pointer.entry || path === 'game.json';
    const headers: Record<string, string> = {
      'content-type': file.contentType,
      'content-length': String(file.body.byteLength),
      etag,
      'cache-control': isDocument ? 'no-cache' : `public, max-age=${maxAge}`,
      'content-security-policy': `frame-ancestors ${opts.portalOrigin}`,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : file.body);
  };

  return createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      // oxlint-disable-next-line no-console -- the only log line the host has
      console.error(`games: ${String(err)}`);
      if (!res.headersSent) {
        end(res, 502, 'Storage unavailable');
      } else {
        res.end();
      }
    });
  });
}

async function readPointer(store: ReadStore, id: string): Promise<Pointer | null> {
  const file = await store.get(`games/${id}/current.json`);
  if (!file) {
    return null;
  }
  try {
    const raw = JSON.parse(new TextDecoder().decode(file.body)) as Partial<Pointer>;
    if (typeof raw.deployId !== 'string' || !/^[0-9a-f-]{36}$/.test(raw.deployId)) {
      return null;
    }
    return {
      deployId: raw.deployId,
      entry: typeof raw.entry === 'string' ? raw.entry : 'index.html',
    };
  } catch {
    return null;
  }
}

function end(
  res: ServerResponse,
  status: number,
  text: string,
  extra: Record<string, string> = {},
) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  });
  res.end(text);
}
