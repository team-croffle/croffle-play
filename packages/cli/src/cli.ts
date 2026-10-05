#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { checkGame } from './check.js';
import type { Findings } from './sdk-status.js';
import { validateBuild } from './validate.js';

const USAGE = `Usage:
  play-cli validate [dir] [--api <url>]
  play-cli check <game url> [--portal <origin>] [--api <url>] [--insecure]

validate  checks a built game site (dir defaults to ./dist): game.json, entry, thumbnail.
check     checks the deployed game: https, framable by the portal, game.json matching the host.

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

  console.error(`error: unknown command '${command}'\n${USAGE}`);
  return 1;
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
