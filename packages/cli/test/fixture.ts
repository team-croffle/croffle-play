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

/** Writes a bundle to a temp dir; `files` overrides/extends the default valid bundle. */
export async function makeBundle(files: Record<string, string | null> = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'play-cli-'));
  const all: Record<string, string | null> = {
    'game.json': JSON.stringify(manifest),
    'index.html': '<!doctype html><script type="module" src="./assets/main.js"></script>',
    'assets/main.js': 'import "./dep.js"; console.log("https://example.com is just text")',
    'assets/dep.js': '',
    'thumb.png': 'png',
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
