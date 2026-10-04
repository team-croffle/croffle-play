import type { AdapterModule } from '@croffledev/play-protocol/host';

/** True when `bytes` match an SRI string (`sha384-<base64>`; sha256/sha512 accepted too). */
export async function verifyIntegrity(bytes: ArrayBuffer, integrity: string): Promise<boolean> {
  const m = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/.exec(integrity.trim());
  if (!m) {
    return false;
  }
  const alg = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }[m[1] as 'sha384'];
  const digest = new Uint8Array(await crypto.subtle.digest(alg, bytes));
  return btoa(String.fromCharCode(...digest)) === m[2];
}

/**
 * Loads a host adapter bundle (design invariant 6). Dynamic `import()` cannot check integrity, so
 * the bytes are fetched, verified against the SRI hash from the API, and imported from a blob URL.
 */
export async function loadAdapter(
  url: string,
  integrity: string,
  deps: {
    fetch?: typeof fetch;
    importModule?: (url: string) => Promise<unknown>;
  } = {},
): Promise<AdapterModule> {
  const res = await (deps.fetch ?? fetch)(url, { credentials: 'omit', mode: 'cors' });
  if (!res.ok) {
    throw new Error(`Adapter download failed (${res.status})`);
  }
  const bytes = await res.arrayBuffer();
  if (!(await verifyIntegrity(bytes, integrity))) {
    throw new Error('Adapter integrity check failed');
  }
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
  try {
    const mod = (await (deps.importModule ?? ((u) => import(/* @vite-ignore */ u)))(blobUrl)) as
      | Partial<AdapterModule>
      | undefined;
    if (typeof mod?.mount !== 'function' || typeof mod.major !== 'number') {
      throw new Error('Not a host adapter module');
    }
    return mod as AdapterModule;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
