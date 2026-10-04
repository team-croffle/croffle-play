import { defineConfig } from 'vitest/config';

const conditions = ['@croffledev/source', 'node', 'import', 'default'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: { include: ['test/**/*.test.ts'] },
});
