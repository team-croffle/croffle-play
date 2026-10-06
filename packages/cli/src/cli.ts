#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { checkGame } from './check.js';
import { deployBuild } from './deploy.js';
import { packBuild } from './pack.js';
import type { Findings } from './sdk-status.js';
import { validateBuild } from './validate.js';

const USAGE = `Usage:
  play-cli validate [dir] [--api <url>]
  play-cli check <game url> [--portal <origin>] [--api <url>] [--insecure]
  play-cli pack [dir] [--out <file.zip>] [--api <url>]
  play-cli deploy [dir | file.zip] [--game <id>] --api <url>

validate  checks a built game site (dir defaults to ./dist): game.json, entry, thumbnail.
check     checks the deployed game: https, framable by the portal, game.json matching the host.
pack      validates the build and zips it for platform hosting (default: <id>.zip).
deploy    uploads the build to the platform with the game's deploy key, read from
          CROFFLE_DEPLOY_KEY (never passed as an argument). A directory is packed first.

--api defaults to CROFFLE_PLAY_API, --portal to CROFFLE_PLAY_PORTAL.`;

function report(r: Findings): void {
  for (const w of r.warnings) {
    console.log(`warning: ${w}`);
  }
  for (const e of r.errors) {
    console.error(`error: ${e}`);
  }
}

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      api: { type: 'string' },
      portal: { type: 'string' },
      insecure: { type: 'boolean' },
      out: { type: 'string' },
      game: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, target] = positionals;
  if (values.help || !command) {
    console.log(USAGE);
    return command || values.help ? 0 : 1;
  }
  const api = values.api ?? process.env.CROFFLE_PLAY_API;
  const portal = values.portal ?? process.env.CROFFLE_PLAY_PORTAL;

  if (command === 'validate') {
    const r = await validateBuild(target ?? 'dist', api ? { api } : {});
    report(r);
    if (r.ok && r.manifest) {
      console.log(`ok: ${r.manifest.id} (${r.manifest.name}), SDK ${r.manifest.sdk}`);
    }
    return r.ok ? 0 : 1;
  }

  if (command === 'check') {
    if (!target) {
      console.error(`error: check needs the game URL\n${USAGE}`);
      return 1;
    }
    const r = await checkGame(target, {
      ...(api ? { api } : {}),
      ...(portal ? { portal } : {}),
      ...(values.insecure ? { insecure: true } : {}),
    });
    report(r);
    if (r.ok) {
      console.log(`ok: ${target} is ready to be registered`);
    }
    return r.ok ? 0 : 1;
  }

  if (command === 'pack') {
    const r = await packBuild(target ?? 'dist', api ? { api } : {});
    report(r);
    if (!r.ok || !r.zip || !r.manifest) {
      return 1;
    }
    const file = values.out ?? `${r.manifest.id}.zip`;
    await writeFile(file, r.zip);
    console.log(`ok: ${file} (${r.fileCount} files, ${mb(r.size)} → ${mb(r.zip.byteLength)})`);
    return 0;
  }

  if (command === 'deploy') {
    const key = process.env.CROFFLE_DEPLOY_KEY;
    if (!key) {
      console.error('error: set CROFFLE_DEPLOY_KEY to the game’s deploy key (cdk_…)');
      return 1;
    }
    if (!api) {
      console.error('error: deploy needs the platform API: --api <url> or CROFFLE_PLAY_API');
      return 1;
    }
    const r = await deployBuild(target ?? 'dist', {
      api,
      key,
      ...(values.game ? { game: values.game } : {}),
    });
    report(r);
    if (r.ok && r.deploy) {
      const d = r.deploy;
      console.log(
        `ok: ${d.gameId} is now serving deploy ${d.id}` +
          `${d.version ? ` (v${d.version})` : ''} — ${d.fileCount} files, ${mb(d.size)}`,
      );
    }
    return r.ok ? 0 : 1;
  }

  console.error(`error: unknown command '${command}'\n${USAGE}`);
  return 1;
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(`error: ${String(err)}`);
    process.exitCode = 1;
  },
);
