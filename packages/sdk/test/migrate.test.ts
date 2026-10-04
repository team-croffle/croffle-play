import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Codemod, migrate } from '../src/cli/migrate.js';

const quiet = () => undefined;

describe('play-sdk migrate', () => {
  it('rejects bad arguments with usage', async () => {
    for (const args of [
      [],
      ['migrate'],
      ['migrate', '2-to-1'],
      ['migrate', 'v1-v2'],
      ['other', '1-to-2'],
    ]) {
      expect(await migrate(args, { log: quiet })).toBe(1);
    }
  });

  it('is a no-op while no codemods exist', async () => {
    const lines: string[] = [];
    expect(await migrate(['migrate', '1-to-2', '.'], { log: (l) => lines.push(l) })).toBe(0);
    expect(lines[0]).toMatch(/No code changes are needed from SDK v1 to v2/);
  });

  it('applies chained steps to source files only', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'migrate-'));
    await mkdir(join(dir, 'src'));
    await mkdir(join(dir, 'node_modules'));
    await writeFile(join(dir, 'src/game.ts'), 'sdk.oldCall();\n');
    await writeFile(join(dir, 'src/readme.md'), 'sdk.oldCall()');
    await writeFile(join(dir, 'node_modules/x.js'), 'sdk.oldCall()');
    const steps: Codemod[] = [
      {
        from: 1,
        to: 2,
        description: 'v1→v2',
        transform: (f) => f.source.replace('oldCall', 'midCall'),
      },
      {
        from: 2,
        to: 3,
        description: 'v2→v3',
        transform: (f) => f.source.replace('midCall', 'newCall'),
      },
    ];
    expect(await migrate(['migrate', '1-to-3', dir], { registry: steps, log: quiet })).toBe(0);
    expect(await readFile(join(dir, 'src/game.ts'), 'utf8')).toBe('sdk.newCall();\n');
    expect(await readFile(join(dir, 'src/readme.md'), 'utf8')).toBe('sdk.oldCall()');
    expect(await readFile(join(dir, 'node_modules/x.js'), 'utf8')).toBe('sdk.oldCall()');
  });
});
