// Stages every public workspace package under packages/* whose version is not on npm yet.
// Auth is npm trusted publishing (OIDC from GitHub Actions) only: no token is read or written.
// Staged versions go live only when a maintainer approves them with 2FA (`npm stage approve`).
// `pnpm pack` rewrites `workspace:` ranges; `npm stage publish` (npm >= 12) does the OIDC exchange.

import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
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
const staged = [];

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
  const args = ['stage', 'publish', tarball, '--access', 'public', '--provenance', '--tag', tag];
  const result = spawnSync('npm', args, { cwd: root, encoding: 'utf8', shell });
  const output = `${result.stdout}${result.stderr}`;
  process.stdout.write(output);
  if (result.status !== 0) {
    // Re-runs before approval find the version already staged; that is not a failure.
    if (/already staged|E409|409 Conflict/i.test(output)) {
      console.log(`skip ${name}@${version} (already staged)`);
      continue;
    }
    throw new Error(`npm stage publish failed for ${name}@${version}`);
  }
  console.log(`staged ${name}@${version} (${tag})`);
  staged.push({ spec: `${name}@${version}`, output: output.trim() });
}

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary && staged.length > 0) {
  const lines = [
    '## Staged on npm — approve to publish',
    '',
    'Approve in this order (dependencies first) on npmjs.com or with `npm stage approve <stage-id>`:',
    '',
    ...staged.flatMap(({ spec, output }) => [`### ${spec}`, '', '```', output, '```', '']),
  ];
  appendFileSync(summary, `${lines.join('\n')}\n`);
}
