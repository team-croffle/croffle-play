import { defineConfig } from 'tsdown';

/** Platform release version (git tag) or `dev`. Each build lands in its own immutable path. */
const version = process.env.VERSION ?? 'dev';

// One self-contained ES module per SDK major. Adapters run on the shell origin, so everything
// (protocol, valibot) is bundled and nothing is fetched at runtime.
export default defineConfig({
  entry: { [`v1/${version}/index`]: 'v1/src/index.ts' },
  format: 'esm',
  outDir: 'dist',
  clean: true,
  dts: false,
  minify: true,
  platform: 'browser',
  target: 'es2022',
  noExternal: () => true,
  outExtensions: () => ({ js: '.js' }),
});
