#!/usr/bin/env node
import { relative } from 'node:path';
import { parseArgs } from 'node:util';

import { CreateError, createGame } from './create.js';
import { CLI_VERSION, SDK_VERSION } from './versions.js';

const USAGE = `Usage: npm create @croffledev/play-game <dir> [-- --id <game-id>] [--name "<Name>"]

The game id defaults to the directory name (lowercase letters, digits, inner hyphens).`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    name: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

const [dir] = positionals;
if (values.help || !dir) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

try {
  const game = await createGame({
    dir,
    ...(values.id ? { id: values.id } : {}),
    ...(values.name ? { name: values.name } : {}),
    sdkVersion: SDK_VERSION,
    cliVersion: CLI_VERSION,
  });
  const where = relative(process.cwd(), game.dir) || '.';
  console.log(`Created ${game.name} (${game.id}) in ${where}

Next:
  cd ${where}
  pnpm install
  pnpm dev          # runs alone with the SDK mock host

Then push the folder to its own GitHub repository, host the build at
https://${game.id}.play.<platform domain>/, and ask a platform admin to register '${game.id}'
(see README.md and the game developer guide).`);
} catch (err) {
  console.error(`error: ${err instanceof CreateError ? err.message : String(err)}`);
  process.exitCode = 1;
}
