#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { formatBytes } from './bundle.js';
import { PublishError, publishBundle } from './publish.js';
import { validateBundle } from './validate.js';

const USAGE = `Usage:
  play-cli validate [dir] [--api <url>] [--max-size <MB>]
  play-cli publish  [dir] --api <url>      (deploy key in CROFFLE_PLAY_DEPLOY_KEY)

dir defaults to ./dist. --api defaults to CROFFLE_PLAY_API.`;

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      api: { type: 'string' },
      'max-size': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, dir = 'dist'] = positionals;
  if (values.help || !command) {
    console.log(USAGE);
    return command || values.help ? 0 : 1;
  }
  const api = values.api ?? process.env.CROFFLE_PLAY_API;
  const maxBytes = values['max-size'] ? Number(values['max-size']) * 1024 * 1024 : undefined;
  const common = { ...(api ? { api } : {}), ...(maxBytes ? { maxBytes } : {}) };

  if (command === 'validate') {
    const r = await validateBundle(dir, common);
    for (const w of r.warnings) {
      console.log(`warning: ${w}`);
    }
    for (const e of r.errors) {
      console.error(`error: ${e}`);
    }
    if (r.ok && r.manifest) {
      console.log(
        `ok: ${r.manifest.id}@${r.manifest.version}, ${r.files.length} files, ${formatBytes(r.totalBytes)}`,
      );
    }
    return r.ok ? 0 : 1;
  }

  if (command === 'publish') {
    const key = process.env.CROFFLE_PLAY_DEPLOY_KEY;
    if (!api || !key) {
      console.error('error: publish needs --api (or CROFFLE_PLAY_API) and CROFFLE_PLAY_DEPLOY_KEY');
      return 1;
    }
    await publishBundle(dir, { ...common, api, key, log: (l) => console.log(l) });
    return 0;
  }

  console.error(`error: unknown command '${command}'\n${USAGE}`);
  return 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(`error: ${err instanceof PublishError ? err.message : String(err)}`);
    process.exitCode = 1;
  },
);
