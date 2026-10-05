import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsdown';

const version = (pkg: string) =>
  (
    JSON.parse(readFileSync(new URL(`../${pkg}/package.json`, import.meta.url), 'utf8')) as {
      version: string;
    }
  ).version;

// The SDK and CLI versions of the same release go into every generated game.
export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: true,
  clean: true,
  define: {
    __SDK_VERSION__: JSON.stringify(version('sdk')),
    __CLI_VERSION__: JSON.stringify(version('cli')),
  },
});
