import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@croffledev/source', ...defaultServerConditions] },
  ssr: { resolve: { conditions: ['@croffledev/source', ...defaultServerConditions] } },
  test: { include: ['test/**/*.test.ts'] },
});
