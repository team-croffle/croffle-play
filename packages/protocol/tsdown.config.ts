import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/host.ts'],
  format: 'esm',
  dts: true,
  clean: true,
  target: 'es2022',
});
