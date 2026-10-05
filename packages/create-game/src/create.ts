import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isValidGameId } from '@croffledev/play-protocol';

/** `template/` next to `src/` and `dist/`, so it resolves from source and from the package. */
export const TEMPLATE_DIR = fileURLToPath(new URL('../template/', import.meta.url));

export interface CreateOptions {
  /** Target directory (must not exist or be empty). */
  dir: string;
  /** Game id; defaults to the directory name. */
  id?: string;
  /** Display name; defaults to the id in title case. */
  name?: string;
  /** Exact SDK and CLI versions to depend on (`^` ranges are written). */
  sdkVersion: string;
  cliVersion: string;
  templateDir?: string;
}

export class CreateError extends Error {
  override readonly name = 'CreateError';
}

/**
 * Copies the game template and fills in the game's id, name, and the current SDK/CLI versions.
 * Dotfiles are stored as `_gitignore` / `_github` because npm drops `.gitignore` from packages.
 */
export async function createGame(
  o: CreateOptions,
): Promise<{ dir: string; id: string; name: string }> {
  const dir = resolve(o.dir);
  const id = o.id ?? basename(dir);
  if (!isValidGameId(id)) {
    throw new CreateError(
      `'${id}' is not a valid game id: 1–32 lowercase letters, digits, or inner hyphens, not a reserved name. Pass --id.`,
    );
  }
  const name = o.name?.trim() || titleCase(id);
  if ((await readdir(dir).catch(() => [])).length > 0) {
    throw new CreateError(`${dir} is not empty`);
  }
  await mkdir(dir, { recursive: true });
  await cp(o.templateDir ?? TEMPLATE_DIR, dir, { recursive: true });
  await rename(join(dir, '_gitignore'), join(dir, '.gitignore'));
  await rename(join(dir, '_github'), join(dir, '.github'));

  const pkg = (await readFile(join(dir, '_package.json'), 'utf8'))
    .replace('{{PACKAGE_NAME}}', id)
    .replace('{{SDK_RANGE}}', `^${o.sdkVersion}`)
    .replace('{{CLI_RANGE}}', `^${o.cliVersion}`);
  await writeFile(join(dir, 'package.json'), pkg);
  await rm(join(dir, '_package.json'));

  const game = JSON.parse(await readFile(join(dir, 'game.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const major = o.sdkVersion.split('.')[0];
  await writeFile(
    join(dir, 'game.json'),
    `${JSON.stringify({ ...game, id, name, sdk: `^${major}.0.0` }, null, 2)}\n`,
  );
  const html = await readFile(join(dir, 'index.html'), 'utf8');
  await writeFile(
    join(dir, 'index.html'),
    html.replace('<title>My Game</title>', `<title>${escapeHtml(name)}</title>`),
  );
  return { dir, id, name };
}

function titleCase(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );
}
