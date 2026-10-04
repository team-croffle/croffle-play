import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

const conditions = ['@croffledev/source', ...defaultServerConditions];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // PGlite boots a WASM Postgres per test file.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
