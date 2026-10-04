import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

export interface BundleFile {
  /** Path inside the bundle, `/`-separated. */
  path: string;
  absPath: string;
  size: number;
}

/** Every regular file under `dir`, sorted. Symlinks and dotfiles are skipped. */
export async function listBundle(dir: string): Promise<BundleFile[]> {
  const out: BundleFile[] = [];
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        out.push({
          path: relative(dir, abs).split(sep).join('/'),
          absPath: abs,
          size: (await stat(abs)).size,
        });
      }
    }
  }
  await walk(dir);
  return out.toSorted((a, b) => a.path.localeCompare(b.path));
}

export async function sha256Base64(absPath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(absPath))
    .digest('base64');
}

/** `Content-Encoding` for pre-compressed files (Unity/Godot `.br`/`.gz` builds). */
export function contentEncodingFor(path: string): 'br' | 'gzip' | undefined {
  if (path.endsWith('.br')) {
    return 'br';
  }
  return path.endsWith('.gz') ? 'gzip' : undefined;
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}
