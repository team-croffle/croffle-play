import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // PGlite boots a WASM Postgres per test file.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
