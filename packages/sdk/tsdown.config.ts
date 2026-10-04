import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsdown';

const { version } = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: { index: 'src/index.ts', mock: 'src/mock/index.ts' },
  format: 'esm',
  dts: true,
  clean: true,
  target: 'es2022',
  define: { __SDK_VERSION__: JSON.stringify(version) },
});
