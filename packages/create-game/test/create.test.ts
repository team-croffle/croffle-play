import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateBundle } from '@croffledev/play-cli';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGame } from '../src/create.js';

// Generated inside this package so `@croffledev/play-sdk` resolves to the workspace link.
const root = fileURLToPath(new URL('../.tmp/', import.meta.url));
let work: string;

beforeAll(async () => {
  await mkdir(root, { recursive: true });
  work = await mkdtemp(join(root, 'run-'));
});

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

const versions = { sdkVersion: '1.4.2', cliVersion: '0.3.0' };

describe('createGame', () => {
  it('fills in id, name, and versions, and restores dotfiles', async () => {
    const g = await createGame({ dir: join(work, 'block-drop'), ...versions });
    expect(g).toMatchObject({ id: 'block-drop', name: 'Block Drop' });
    const files = await readdir(g.dir);
    expect(files).toEqual(
      expect.arrayContaining(['.gitignore', '.github', 'package.json', 'game.json']),
    );
    expect(files).not.toEqual(expect.arrayContaining(['_gitignore', '_github', '_package.json']));
    const pkg = JSON.parse(await readFile(join(g.dir, 'package.json'), 'utf8'));
    expect(pkg).toMatchObject({
      name: 'block-drop',
      dependencies: { '@croffledev/play-sdk': '^1.4.2' },
      devDependencies: { '@croffledev/play-cli': '^0.3.0' },
    });
    expect(JSON.parse(await readFile(join(g.dir, 'game.json'), 'utf8'))).toMatchObject({
      id: 'block-drop',
      name: 'Block Drop',
      sdk: '^1.0.0',
    });
    expect(await readFile(join(g.dir, 'index.html'), 'utf8')).toContain(
      '<title>Block Drop</title>',
    );
    expect(await readdir(join(g.dir, '.github/workflows'))).toEqual(['ci.yml', 'publish.yml']);
  });

  it('takes an explicit id and name, escaping the name in HTML', async () => {
    const g = await createGame({
      dir: join(work, 'x'),
      id: 'my-puzzle',
      name: 'Puzzle <3',
      ...versions,
    });
    expect(await readFile(join(g.dir, 'index.html'), 'utf8')).toContain(
      '<title>Puzzle &lt;3</title>',
    );
  });

  it('refuses invalid ids and non-empty directories', async () => {
    await expect(createGame({ dir: join(work, 'Bad_Name'), ...versions })).rejects.toThrow(
      /not a valid game id/,
    );
    await expect(createGame({ dir: join(work, 'api'), ...versions })).rejects.toThrow(
      /not a valid game id/,
    );
    const busy = join(work, 'busy');
    await mkdir(busy);
    await writeFile(join(busy, 'keep.txt'), 'x');
    await expect(createGame({ dir: busy, ...versions })).rejects.toThrow(/not empty/);
  });
});

describe('a generated game', () => {
  it('typechecks, builds, and passes play-cli validate', async () => {
    const g = await createGame({
      dir: join(work, 'tetris'),
      sdkVersion: '0.0.0',
      cliVersion: '0.0.0',
    });
    const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
    execFileSync(process.execPath, [tsc, '--noEmit', '-p', g.dir], { stdio: 'pipe' });
    await build({
      root: g.dir,
      configFile: join(g.dir, 'vite.config.ts'),
      logLevel: 'silent',
      resolve: {
        conditions: ['@croffledev/source', 'module', 'browser', 'development|production'],
      },
    });
    execFileSync(process.execPath, ['scripts/write-manifest.mjs'], {
      cwd: g.dir,
      env: { ...process.env, GAME_VERSION: 'v1.2.3' },
    });
    const result = await validateBundle(join(g.dir, 'dist'));
    expect(result.errors).toEqual([]);
    expect(result.manifest).toMatchObject({ id: 'tetris', version: '1.2.3' });
  });
});
