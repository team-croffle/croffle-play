import type { H3Event } from 'h3';

/**
 * Relays an immutable platform file (host adapter, avatar) from the API, so the browser loads it
 * from the portal's own origin: no CORS, and the API stays unreachable from pages.
 */
export async function relayStoredFile(event: H3Event, apiPath: string): Promise<Uint8Array> {
  const res = await proxied(() =>
    $fetch.raw<ArrayBuffer>(apiPath, {
      baseURL: useRuntimeConfig().apiBase,
      responseType: 'arrayBuffer',
    }),
  );
  setResponseHeaders(event, {
    'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
    'Cache-Control': res.headers.get('cache-control') ?? 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  return new Uint8Array(res._data ?? new ArrayBuffer(0));
}
