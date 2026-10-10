// `pnpm dev:games` — builds the fixture games and the host adapters, then serves them the way
// self-hosted games are served in production, one origin per game:
//   http://<game>.localhost:4100/…              fixture sites (dev/games/<game>, with game.json)
//   http://localhost:4100/adapters/v<N>/<any>/… packages/adapter-v<N>/dist (development adapter host)
// Chrome and Firefox resolve *.localhost to loopback; Safari needs hosts-file entries.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, posix, resolve } from 'node:path';

import { build } from 'vite';

const port = Number(process.env.GAMES_PORT ?? 4100);
const here = import.meta.dirname;
const out = join(here, '.out');
const packagesDir = resolve(here, '../../../packages');
// Like a real game host: only the portal may frame the game.
const PORTAL_ORIGIN = process.env.PORTAL_ORIGIN ?? 'http://localhost:3000';

// pnpm is a .cmd shim on Windows: spawn it through the shell there.
execFileSync('pnpm', ['--filter', '@croffledev/play-adapter-v*', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
for (const game of readdirSync(join(here, 'games'))) {
  await build({
    configFile: false,
    root: join(here, 'games', game),
    base: './',
    logLevel: 'warn',
    resolve: { conditions: ['@croffledev/source', 'module', 'browser', 'development|production'] },
    build: { outDir: join(out, game), emptyOutDir: true, target: 'es2022' },
  });
}

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

createServer((req, res) => {
  // URL paths are POSIX on every OS (node:path normalize uses backslashes on Windows).
  const path = posix.normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  const game = /^([a-z0-9-]+)\.localhost(?::\d+)?$/.exec(req.headers.host ?? '')?.[1];
  const isAdapter = !game && path.startsWith('/adapters/');
  if (!game && !isAdapter) {
    res.writeHead(404).end('not found');
    return;
  }
  // /adapters/v1/<anything>/<file> → packages/adapter-v1/dist/<file>: the version segment is
  // whatever the manifest says; development never pins one.
  const adapter = isAdapter ? /^\/adapters\/(v\d+)\/[^/]+\/(.*)$/.exec(path) : null;
  if (isAdapter && !adapter) {
    res.writeHead(404).end('not found');
    return;
  }
  const root = adapter ? join(packagesDir, `adapter-${adapter[1]}`, 'dist') : join(out, game ?? '');
  let file = join(root, adapter ? adapter[2] : path);
  if (!file.startsWith(root)) {
    res.writeHead(400).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    ...(isAdapter
      ? { 'Access-Control-Allow-Origin': '*' }
      : { 'Content-Security-Policy': `frame-ancestors ${PORTAL_ORIGIN}` }),
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`dev games on http://<game>.localhost:${port}/ (game.json at the root)`);
  console.log(`  adapter manifest: http://localhost:${port}/adapters/v1/dev/manifest.json`);
});
