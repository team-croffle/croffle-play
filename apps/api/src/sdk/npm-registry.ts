import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Parser } from 'tar';
import * as v from 'valibot';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/** `fetch` used for the registry; tests inject a fake. */
export const NPM_FETCH = Symbol('NPM_FETCH');

/** One published version of an adapter package, from the registry's packument. */
export interface AdapterRelease {
  version: string;
  tarball: string;
  /** npm's `dist.integrity` (`sha512-…`). */
  integrity: string;
  requiresApi: string | null;
}

const packumentSchema = v.object({
  versions: v.record(
    v.string(),
    v.object({
      dist: v.object({ tarball: v.pipe(v.string(), v.url()), integrity: v.optional(v.string()) }),
      croffle: v.optional(v.object({ requiresApi: v.optional(v.string()) })),
    }),
  ),
});

/** Name of the adapter package of an SDK major. Fixed: nothing else is ever installed. */
export function adapterPackage(major: number): string {
  return `@croffledev/play-adapter-v${major}`;
}

/** The two files of an adapter bundle, as found in a package tarball under `package/dist/`. */
export interface AdapterBundleFiles {
  index: Uint8Array;
  manifest: Uint8Array;
}

/** Tarball size cap: an adapter is tens of KB; anything near this is wrong. */
const MAX_TARBALL_BYTES = 5 * 1024 * 1024;

/**
 * Reads adapter packages from the npm registry (`NPM_REGISTRY_URL`): which versions exist, and
 * the bundle of one version, checked against npm's sha512 before anything else looks at it.
 */
@Injectable()
export class NpmRegistry {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(NPM_FETCH) private readonly fetchImpl: typeof fetch,
  ) {}

  /** Published versions of the major's adapter package, newest first. */
  async releases(major: number): Promise<AdapterRelease[]> {
    const url = new URL(
      encodeURIComponent(adapterPackage(major)),
      ensureSlash(this.env.NPM_REGISTRY_URL),
    );
    const res = await this.fetchImpl(url, { headers: { accept: 'application/json' } });
    if (res.status === 404) {
      return [];
    }
    if (!res.ok) {
      throw new Error(`${url} → ${res.status}`);
    }
    const doc = v.parse(packumentSchema, await res.json());
    return Object.entries(doc.versions)
      .filter(([version, info]) => /^\d+\.\d+\.\d+/.test(version) && info.dist.integrity)
      .map(([version, info]) => ({
        version,
        tarball: info.dist.tarball,
        integrity: info.dist.integrity as string,
        requiresApi: info.croffle?.requiresApi ?? null,
      }))
      .toSorted((a, b) => compareVersions(b.version, a.version));
  }

  /** Downloads a release and returns its `dist/index.js` and `dist/manifest.json`. */
  async bundle(release: AdapterRelease): Promise<AdapterBundleFiles> {
    const res = await this.fetchImpl(release.tarball);
    if (!res.ok) {
      throw new Error(`${release.tarball} → ${res.status}`);
    }
    const tgz = new Uint8Array(await res.arrayBuffer());
    if (tgz.byteLength > MAX_TARBALL_BYTES) {
      throw new Error(`${release.tarball} is ${tgz.byteLength} bytes; adapters are far smaller`);
    }
    assertIntegrity(tgz, release.integrity);
    return extractBundle(tgz);
  }
}

function ensureSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/** npm `dist.integrity` is SRI: `sha512-<base64>` (possibly several, space separated). */
export function assertIntegrity(bytes: Uint8Array, integrity: string): void {
  const ok = integrity.split(/\s+/).some((entry) => {
    const [algo, digest] = entry.split('-', 2);
    if (!algo || !digest || !['sha512', 'sha384', 'sha256'].includes(algo)) {
      return false;
    }
    return createHash(algo).update(bytes).digest('base64') === digest;
  });
  if (!ok) {
    throw new Error('tarball does not match the registry integrity');
  }
}

/** Pulls `package/dist/index.js` and `package/dist/manifest.json` out of a package tarball. */
export function extractBundle(tgz: Uint8Array): Promise<AdapterBundleFiles> {
  return new Promise((resolve, reject) => {
    const found: Partial<AdapterBundleFiles> = {};
    const parser = new Parser({
      onReadEntry: (entry) => {
        const name = entry.path.replace(/^package\//, '');
        if (name !== 'dist/index.js' && name !== 'dist/manifest.json') {
          entry.resume();
          return;
        }
        const chunks: Buffer[] = [];
        entry.on('data', (c: Buffer) => chunks.push(c));
        entry.on('end', () => {
          found[name === 'dist/index.js' ? 'index' : 'manifest'] = new Uint8Array(
            Buffer.concat(chunks),
          );
        });
      },
    });
    parser.on('error', reject);
    parser.on('end', () => {
      if (!found.index || !found.manifest) {
        reject(new Error('the package has no dist/index.js + dist/manifest.json'));
        return;
      }
      resolve({ index: found.index, manifest: found.manifest });
    });
    parser.end(Buffer.from(tgz.buffer, tgz.byteOffset, tgz.byteLength));
  });
}

/** Semver order (numeric parts, then pre-release); good enough for adapter releases. */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa.nums[i] !== pb.nums[i]) {
      return (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    }
  }
  if (pa.pre === pb.pre) {
    return 0;
  }
  if (pa.pre === '') {
    return 1;
  }
  if (pb.pre === '') {
    return -1;
  }
  return pa.pre < pb.pre ? -1 : 1;
}

function parse(version: string): { nums: number[]; pre: string } {
  const [core, pre = ''] = version.split('-', 2);
  return { nums: (core ?? '').split('.').map(Number), pre };
}
