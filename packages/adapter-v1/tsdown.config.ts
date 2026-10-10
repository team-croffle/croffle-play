import { defineConfig } from 'tsdown';

// One self-contained ES module. Adapters run on the shell origin, so everything (protocol,
// valibot) is bundled and nothing is fetched at runtime. The version is the package version:
// Changesets bumps it together with @croffledev/play-sdk (linked).
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: 'esm',
  outDir: 'dist',
  clean: true,
  dts: false,
  minify: true,
  platform: 'browser',
  target: 'es2022',
  noExternal: () => true,
  // Bundle workspace packages from source: a stale package dist must never end up in an adapter.
  inputOptions: { resolve: { conditionNames: ['@croffledev/source', 'import', 'default'] } },
  outExtensions: () => ({ js: '.js' }),
});
