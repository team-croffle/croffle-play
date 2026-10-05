// Publishes every public workspace package under packages/* whose version is not on npm yet.
// Auth is npm trusted publishing (OIDC from GitHub Actions) only: no token is read or written.
// `pnpm pack` rewrites `workspace:` ranges; `npm publish` (>= 11.5.1) does the OIDC exchange.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const shell = process.platform === 'win32';
const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', shell, stdio: ['ignore', 'pipe', 'inherit'] });

function isPublished(name, version) {
  try {
    return run('npm', ['view', `${name}@${version}`, 'version']).trim() === version;
  } catch {
    return false;
  }
}

const packages = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const dir = join(root, 'packages', entry.name);
    return { dir, manifest: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) };
  })
  .filter(({ manifest }) => !manifest.private);

// The SDK package major is the SDK major games announce; the platform needs its host adapter.
function assertSdkAdapter({ name, version }) {
  const major = version.split('.')[0];
  if (name === '@croffledev/play-sdk' && !existsSync(join(root, 'apps', 'adapters', `v${major}`))) {
    throw new Error(`${name}@${version}: no apps/adapters/v${major} for SDK v${major}`);
  }
}

const names = new Set(packages.map(({ manifest }) => manifest.name));
const internalDeps = ({ manifest }) =>
  Object.keys(manifest.dependencies ?? {}).filter((dep) => names.has(dep)).length;
packages.sort((a, b) => internalDeps(a) - internalDeps(b));

const outDir = mkdtempSync(join(tmpdir(), 'croffle-publish-'));
const published = [];

for (const pkg of packages) {
  const { name, version } = pkg.manifest;
  if (isPublished(name, version)) {
    console.log(`skip ${name}@${version} (already on npm)`);
    continue;
  }
  assertSdkAdapter(pkg.manifest);
  const packed = run('pnpm', ['pack', '--json', '--pack-destination', outDir], pkg.dir);
  const tarball = JSON.parse(packed).filename;
  const tag = version.includes('-') ? 'next' : 'latest';
  run('npm', ['publish', tarball, '--access', 'public', '--provenance', '--tag', tag]);
  console.log(`published ${name}@${version} (${tag})`);
  published.push(`${name}@${version}`);
}

if (published.length > 0) {
  for (const tag of published) {
    run('git', ['tag', tag]);
  }
  run('git', ['push', 'origin', ...published.map((tag) => `refs/tags/${tag}`)]);
}
