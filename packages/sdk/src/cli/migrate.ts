import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** One source file a codemod may rewrite. */
export interface SourceFile {
  path: string;
  source: string;
}

/** Rewrites code from one SDK major to the next. Returns null when a file needs no change. */
export interface Codemod {
  from: number;
  to: number;
  description: string;
  transform(file: SourceFile): string | null;
}

/**
 * Codemods by `<from>-to-<to>`. Empty until SDK v2 exists; each new major adds its step here,
 * and a multi-major jump runs the steps in order.
 */
export const codemods: readonly Codemod[] = [];

const SOURCE = /\.(?:[cm]?[jt]sx?|vue|svelte)$/;
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '.nuxt', '.output']);

export const USAGE = `Usage: play-sdk migrate <from>-to-<to> [dir]

Rewrites game code for a new @croffledev/play-sdk major, e.g.
  npx @croffledev/play-sdk migrate 1-to-2 src`;

/** CLI entry: returns the exit code. */
export async function migrate(
  args: string[],
  opts: { registry?: readonly Codemod[]; log?: (line: string) => void } = {},
): Promise<number> {
  const log = opts.log ?? ((l: string) => process.stdout.write(`${l}\n`));
  const registry = opts.registry ?? codemods;
  const [command, range, dir = '.'] = args;
  const m = /^(\d+)-to-(\d+)$/.exec(range ?? '');
  if (command !== 'migrate' || !m || Number(m[1]) >= Number(m[2])) {
    log(USAGE);
    return 1;
  }
  const from = Number(m[1]);
  const to = Number(m[2]);
  const steps: Codemod[] = [];
  for (let major = from; major < to; major++) {
    const step = registry.find((c) => c.from === major && c.to === major + 1);
    if (step) {
      steps.push(step);
    }
  }
  if (steps.length === 0) {
    log(
      `No code changes are needed from SDK v${from} to v${to}. Update the dependency and rebuild.`,
    );
    return 0;
  }
  let changed = 0;
  for (const path of await sourceFiles(dir)) {
    let source = await readFile(path, 'utf8');
    let touched = false;
    for (const step of steps) {
      const next = step.transform({ path, source });
      if (next !== null && next !== source) {
        source = next;
        touched = true;
      }
    }
    if (touched) {
      await writeFile(path, source);
      changed++;
      log(`updated ${path}`);
    }
  }
  log(`${steps.map((s) => s.description).join('; ')} — ${changed} file(s) changed.`);
  return 0;
}

async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !SKIP.has(entry.name)) {
      out.push(...(await sourceFiles(path)));
    } else if (entry.isFile() && SOURCE.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}
