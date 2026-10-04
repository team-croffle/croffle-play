import { defineConfig } from 'vitest/config';

// Node's own conditions (no bundler-only `module`), plus workspace packages from source.
const conditions = ['@croffledev/source', 'node', 'import', 'default'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: ['node', 'import'] } },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // PGlite boots a WASM Postgres per test file.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
