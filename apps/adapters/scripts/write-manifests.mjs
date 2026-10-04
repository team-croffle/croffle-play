// Writes dist/v<major>/<version>/manifest.json with the SRI hash of each adapter bundle.
// The API registers adapters from this file (`sdk:register <manifest-url>`).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
for (const majorDir of readdirSync(dist)) {
  const major = Number(/^v(\d+)$/.exec(majorDir)?.[1]);
  if (!major) {
    continue;
  }
  for (const version of readdirSync(join(dist, majorDir))) {
    const dir = join(dist, majorDir, version);
    const bundle = readFileSync(join(dir, 'index.js'));
    const integrity = `sha384-${createHash('sha384').update(bundle).digest('base64')}`;
    const manifest = { major, version, file: 'index.js', integrity };
    writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`${majorDir}/${version}: ${bundle.length} bytes ${integrity}`);
  }
}
