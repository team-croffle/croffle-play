// `pnpm dev:games` — builds the fixture games and the host adapters, then serves them on their own
// origin (default http://localhost:4100), like the game domain and adapter storage in production:
//   /<game>/<version>/…      fixture game bundles (dev/games/<game>, version 1.0.0)
//   /adapters/v<N>/<ver>/…   apps/adapters/dist (CORS enabled: the shell fetches them)
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

import { build } from 'vite';

const port = Number(process.env.GAMES_PORT ?? 4100);
const here = import.meta.dirname;
const out = join(here, '.out');
const adaptersDist = resolve(here, '../../adapters/dist');
const FIXTURE_VERSION = '1.0.0';

execFileSync('pnpm', ['--filter', '@croffledev/play-adapters', 'build'], { stdio: 'inherit' });
for (const game of readdirSync(join(here, 'games'))) {
  await build({
    configFile: false,
    root: join(here, 'games', game),
    base: './',
    logLevel: 'warn',
    resolve: { conditions: ['@croffledev/source', 'module', 'browser', 'development|production'] },
    build: { outDir: join(out, game, FIXTURE_VERSION), emptyOutDir: true, target: 'es2022' },
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
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  const isAdapter = path.startsWith('/adapters/');
  const root = isAdapter ? adaptersDist : out;
  let file = join(root, isAdapter ? path.slice('/adapters'.length) : path);
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
    ...(isAdapter ? { 'Access-Control-Allow-Origin': '*' } : {}),
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`dev games on http://localhost:${port}`);
  console.log(`  adapter manifest: http://localhost:${port}/adapters/v1/dev/manifest.json`);
});
