import * as v from 'valibot';

import type { Db } from '../db/db.js';
import { sdkVersions } from '../db/schema.js';

/** `manifest.json` written next to each adapter bundle by `apps/adapters`. */
export const adapterManifestSchema = v.object({
  major: v.pipe(v.number(), v.integer(), v.minValue(1)),
  version: v.string(),
  file: v.string(),
  integrity: v.pipe(v.string(), v.startsWith('sha384-')),
});
export type AdapterManifest = v.InferOutput<typeof adapterManifestSchema>;

/**
 * Points SDK major `manifest.major` at an adapter bundle. Creates the major as `current` if it
 * does not exist; never changes the lifecycle status of an existing one.
 */
export async function registerAdapter(
  db: Db,
  manifest: AdapterManifest,
  manifestUrl: string,
): Promise<{ major: number; adapterUrl: string; sri: string }> {
  const adapterUrl = new URL(manifest.file, manifestUrl).href;
  await db
    .insert(sdkVersions)
    .values({ major: manifest.major, adapterUrl, sri: manifest.integrity })
    .onConflictDoUpdate({
      target: sdkVersions.major,
      set: { adapterUrl, sri: manifest.integrity },
    });
  return { major: manifest.major, adapterUrl, sri: manifest.integrity };
}

export async function fetchAdapterManifest(url: string): Promise<AdapterManifest> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`);
  }
  return v.parse(adapterManifestSchema, await res.json());
}
