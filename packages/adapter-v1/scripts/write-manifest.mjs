// Writes dist/manifest.json: what the api checks before registering this bundle — its SRI hash,
// SDK major, version (= package version), and the api versions it needs (`requiresApi`).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
const bundle = readFileSync(`${root}dist/index.js`);
const manifest = {
  major: pkg.croffle.sdkMajor,
  version: pkg.version,
  file: 'index.js',
  integrity: `sha384-${createHash('sha384').update(bundle).digest('base64')}`,
  requiresApi: pkg.croffle.requiresApi,
};
writeFileSync(`${root}dist/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`v${manifest.major} ${manifest.version}: ${bundle.length} bytes ${manifest.integrity}`);
