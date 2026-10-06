import { type Zippable, zipSync } from 'fflate';

export interface ZipEntry {
  path: string;
  body?: string | Uint8Array;
  /** Unix mode; `0o120777` makes a symbolic link entry. */
  mode?: number;
}

/** A zip in memory, as a game team's build tool would produce it. Paths are written verbatim. */
export async function buildZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const files: Zippable = {};
  for (const e of entries) {
    const body =
      typeof e.body === 'string' ? new TextEncoder().encode(e.body) : (e.body ?? new Uint8Array());
    // os 3 = Unix, so the high 16 bits of the external attributes carry the mode.
    files[e.path] = e.mode === undefined ? body : [body, { os: 3, attrs: e.mode << 16 }];
  }
  return zipSync(files);
}

/** A minimal valid game build for `id`. */
export function gameBuild(id: string, extra: ZipEntry[] = [], manifest: object = {}): ZipEntry[] {
  return [
    { path: 'game.json', body: JSON.stringify({ id, name: id, sdk: '^1.0.0', ...manifest }) },
    { path: 'index.html', body: '<!doctype html><title>g</title>' },
    { path: 'assets/main.js', body: 'console.log(1)' },
    ...extra,
  ];
}
