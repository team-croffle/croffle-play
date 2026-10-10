import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';
import * as v from 'valibot';

import type { Db } from '../db/db.js';
import { sdkAdapterVersions, sdkAdminEvents } from '../db/schema-sdk.js';
import { sdkVersions } from '../db/schema.js';
import { IMMUTABLE_CACHE_CONTROL, type Storage } from '../storage/storage.js';

/** Adapter release names: `1.0.0`, `0.10.0-rc.1`. */
export const ADAPTER_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;

/** `manifest.json` next to each adapter bundle (`packages/adapter-v<N>`, `dist/manifest.json`). */
export const adapterManifestSchema = v.object({
  major: v.pipe(v.number(), v.integer(), v.minValue(1)),
  /** Release name; `dev` for local builds (`pnpm dev:games`). */
  version: v.pipe(v.string(), v.minLength(1)),
  file: v.string(),
  integrity: v.pipe(v.string(), v.startsWith('sha384-')),
  /** Platform api versions this adapter can talk to (semver range); absent = any. */
  requiresApi: v.optional(v.string()),
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

export type AdapterSource = (typeof sdkAdapterVersions.$inferSelect)['source'];

/**
 * Points SDK major `manifest.major` at an adapter bundle and records the version. Creates the
 * major as `current` if it does not exist; never changes the lifecycle status of an existing one.
 * The switch is recorded in `sdk_admin_events` (`actor` null: register-cli or the api at boot).
 * The row is locked first, so two api instances booting at once record one switch, not two.
 */
export async function registerAdapter(
  db: Db,
  manifest: AdapterManifest,
  adapterUrl: string,
  source: AdapterSource = 'cli',
  actor: string | null = null,
): Promise<{ major: number; adapterUrl: string; sri: string }> {
  await db.transaction(async (tx) => {
    const [prev] = await tx
      .select({ adapterUrl: sdkVersions.adapterUrl })
      .from(sdkVersions)
      .where(eq(sdkVersions.major, manifest.major))
      .for('update');
    await tx
      .insert(sdkVersions)
      .values({ major: manifest.major, adapterUrl, sri: manifest.integrity })
      .onConflictDoUpdate({
        target: sdkVersions.major,
        set: { adapterUrl, sri: manifest.integrity },
      });
    await tx
      .insert(sdkAdapterVersions)
      .values({
        major: manifest.major,
        version: manifest.version,
        url: adapterUrl,
        sri: manifest.integrity,
        source,
      })
      .onConflictDoUpdate({
        target: [sdkAdapterVersions.major, sdkAdapterVersions.version],
        set: { url: adapterUrl, sri: manifest.integrity, source, registeredAt: new Date() },
      });
    if (prev?.adapterUrl !== adapterUrl) {
      await tx.insert(sdkAdminEvents).values({
        major: manifest.major,
        kind: 'adapter_activated',
        from: { adapterUrl: prev?.adapterUrl ?? null },
        to: { adapterUrl, version: manifest.version, source },
        actor,
      });
    }
  });
  return { major: manifest.major, adapterUrl, sri: manifest.integrity };
}

/**
 * Release path: uploads `<dir>/index.js` (an adapter package's `dist/`, or the image's bundle dir) to storage
 * after checking it against the manifest's SRI hash, then registers it.
 */
export async function publishAdapterDir(
  db: Db,
  storage: Storage,
  dir: string,
  source: AdapterSource = 'cli',
  actor: string | null = null,
) {
  const manifest = v.parse(
    adapterManifestSchema,
    JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')),
  );
  if (manifest.file !== 'index.js') {
    throw new Error(`manifest.file must be index.js, not ${manifest.file}`);
  }
  if (!ADAPTER_VERSION.test(manifest.version)) {
    throw new Error(`release adapters need a version like 1.2.0, not '${manifest.version}'`);
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
  return registerAdapter(
    db,
    manifest,
    adapterPath(manifest.major, manifest.version),
    source,
    actor,
  );
}

/** Development path: an adapter already served elsewhere (`pnpm dev:games`), by manifest URL. */
export async function registerAdapterUrl(db: Db, manifestUrl: string) {
  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new Error(`GET ${manifestUrl} → ${res.status}`);
  }
  const manifest = v.parse(adapterManifestSchema, await res.json());
  return registerAdapter(db, manifest, new URL(manifest.file, manifestUrl).href, 'dev');
}
