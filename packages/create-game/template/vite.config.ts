import { defineConfig } from 'vite';

// Bundles are served from https://<id>.croffle-play.link/<version>/ — every path must be relative,
// and nothing may be loaded from other hosts.
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
