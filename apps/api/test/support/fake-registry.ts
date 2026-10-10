import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { create as createTar } from 'tar';

export const REGISTRY = 'https://registry.test/';

export interface Published {
  version: string;
  requiresApi: string;
  tgz: Uint8Array;
  integrity: string;
}

/** Builds `@croffledev/play-adapter-v1@<version>` the way `pnpm pack` would. */
export async function publish(
  version: string,
  requiresApi: string,
  code: string,
): Promise<Published> {
  const root = await mkdtemp(join(tmpdir(), 'adapter-pkg-'));
  const dist = join(root, 'package', 'dist');
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, 'index.js'), code);
  const integrity = `sha384-${createHash('sha384').update(code).digest('base64')}`;
  await writeFile(
    join(dist, 'manifest.json'),
    JSON.stringify({ major: 1, version, file: 'index.js', integrity, requiresApi }),
  );
  await writeFile(join(root, 'package', 'package.json'), '{}');
  const file = join(root, 'pkg.tgz');
  await createTar({ gzip: true, cwd: root, file }, ['package']);
  const tgz = new Uint8Array(await readFile(file));
  await rm(root, { recursive: true, force: true });
  return {
    version,
    requiresApi,
    tgz,
    integrity: `sha512-${createHash('sha512').update(tgz).digest('base64')}`,
  };
}

/** A registry with one package: packument + tarballs. `tamper` corrupts every tarball. */
export function registry(published: Published[], tamper = false): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url === `${REGISTRY}${encodeURIComponent('@croffledev/play-adapter-v1')}`) {
      const versions: Record<string, unknown> = {};
      for (const p of published) {
        versions[p.version] = {
          dist: { tarball: `${REGISTRY}tarballs/${p.version}.tgz`, integrity: p.integrity },
          croffle: { requiresApi: p.requiresApi },
        };
      }
      return new Response(JSON.stringify({ versions }), { status: 200 });
    }
    const m = /tarballs\/(.+)\.tgz$/.exec(url);
    const p = m && published.find((x) => x.version === m[1]);
    if (p) {
      const body = tamper ? new Uint8Array([...p.tgz, 0]) : p.tgz;
      return new Response(Buffer.from(body), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}
