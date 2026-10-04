import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const manifest = {
  id: 'tetris',
  name: 'Tetris',
  version: '1.0.0',
  thumbnail: 'thumb.png',
  sdk: '^1.0.0',
};

/** A PNG header (all play-cli reads) for an image of the given size. */
export function pngHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

/** Writes a bundle to a temp dir; `files` overrides/extends the default valid bundle. */
export async function makeBundle(
  files: Record<string, string | Buffer | null> = {},
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'play-cli-'));
  const all: Record<string, string | Buffer | null> = {
    'game.json': JSON.stringify(manifest),
    'index.html': '<!doctype html><script type="module" src="./assets/main.js"></script>',
    'assets/main.js': 'import "./dep.js"; console.log("https://example.com is just text")',
    'assets/dep.js': '',
    'thumb.png': pngHeader(320, 180),
    ...files,
  };
  for (const [path, body] of Object.entries(all)) {
    if (body !== null) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), body);
    }
  }
  return dir;
}
