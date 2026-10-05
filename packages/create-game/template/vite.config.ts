import { defineConfig } from 'vite';

// The game is served at the root of its own origin (https://<id>.play.croffle-play.link/) and shown
// in the portal's iframe. Relative paths keep it working under any host or path.
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
