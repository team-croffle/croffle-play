import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as v from 'valibot';

import type { Db } from '../db/db.js';
import { sdkVersions } from '../db/schema.js';
import { IMMUTABLE_CACHE_CONTROL, type Storage } from '../storage/storage.js';

/** Adapter release names: `1.0.0`, `0.10.0-rc.1`. */
export const ADAPTER_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;

/** `manifest.json` written next to each adapter bundle by `apps/adapters`. */
export const adapterManifestSchema = v.object({
  major: v.pipe(v.number(), v.integer(), v.minValue(1)),
  version: v.pipe(v.string(), v.regex(ADAPTER_VERSION)),
  file: v.string(),
  integrity: v.pipe(v.string(), v.startsWith('sha384-')),
});
export type AdapterManifest = v.InferOutput<typeof adapterManifestSchema>;

/** Storage key of an adapter bundle, served by the API at `/v1/adapters/v<N>/<version>/index.js`. */
export function adapterKey(major: number, version: string): string {
  return `adapters/v${major}/${version}/index.js`;
}

/** Where the portal loads it from: same origin, relayed to the API (no CORS anywhere). */
export function adapterPath(major: number, version: string): string {
  return `/adapters/v${major}/${version}/index.js`;
}

/**
 * Points SDK major `manifest.major` at an adapter bundle. Creates the major as `current` if it
 * does not exist; never changes the lifecycle status of an existing one.
 */
export async function registerAdapter(
  db: Db,
  manifest: AdapterManifest,
  adapterUrl: string,
): Promise<{ major: number; adapterUrl: string; sri: string }> {
  await db
    .insert(sdkVersions)
    .values({ major: manifest.major, adapterUrl, sri: manifest.integrity })
    .onConflictDoUpdate({
      target: sdkVersions.major,
      set: { adapterUrl, sri: manifest.integrity },
    });
  return { major: manifest.major, adapterUrl, sri: manifest.integrity };
}

/**
 * Release path: uploads `<dir>/index.js` (from `apps/adapters/dist/v<N>/<version>/`) to storage
 * after checking it against the manifest's SRI hash, then registers it.
 */
export async function publishAdapterDir(db: Db, storage: Storage, dir: string) {
  const manifest = v.parse(
    adapterManifestSchema,
    JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')),
  );
  if (manifest.file !== 'index.js') {
    throw new Error(`manifest.file must be index.js, not ${manifest.file}`);
  }
  const body = await readFile(join(dir, manifest.file));
  const integrity = `sha384-${createHash('sha384').update(body).digest('base64')}`;
  if (integrity !== manifest.integrity) {
    throw new Error(`index.js does not match the manifest integrity (${integrity})`);
  }
  await storage.put(adapterKey(manifest.major, manifest.version), {
    body,
    contentType: 'text/javascript; charset=utf-8',
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  });
  return registerAdapter(db, manifest, adapterPath(manifest.major, manifest.version));
}

/** Development path: an adapter already served elsewhere (`pnpm dev:games`), by manifest URL. */
export async function registerAdapterUrl(db: Db, manifestUrl: string) {
  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new Error(`GET ${manifestUrl} → ${res.status}`);
  }
  const manifest = v.parse(adapterManifestSchema, await res.json());
  return registerAdapter(db, manifest, new URL(manifest.file, manifestUrl).href);
}
