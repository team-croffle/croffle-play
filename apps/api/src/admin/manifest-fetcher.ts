/** Reads a game's `game.json` from its own origin. Tests swap it for a fake. */
export type ManifestFetcher = (url: string, timeoutMs: number) => Promise<unknown>;

export const MANIFEST_FETCHER = Symbol('MANIFEST_FETCHER');

/** Upper bound for a `game.json`; real ones are a few hundred bytes. */
const MAX_BYTES = 64 * 1024;

export class ManifestFetchError extends Error {}

/**
 * GET without redirects or cookies, bounded in time and size. The URL always comes from the game
 * origin template and a validated id, never from user input.
 */
export const fetchManifest: ManifestFetcher = async (url, timeoutMs) => {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: 'error',
      credentials: 'omit',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ManifestFetchError(`${url} is unreachable (${(err as Error).message})`);
  }
  if (!res.ok) {
    throw new ManifestFetchError(`${url} answered ${res.status}`);
  }
  const text = await res.text();
  if (text.length > MAX_BYTES) {
    throw new ManifestFetchError(`${url} is larger than ${MAX_BYTES} bytes`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ManifestFetchError(`${url} is not JSON`);
  }
};
