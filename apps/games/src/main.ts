import { parseConfig } from './config.js';
import { createGameHost } from './server.js';
import { storeFromConfig } from './store.js';

const config = parseConfig(process.env);
const server = createGameHost({
  store: storeFromConfig(config),
  originTemplate: config.GAME_ORIGIN_TEMPLATE,
  portalOrigin: config.PORTAL_ORIGIN,
  pointerTtlMs: config.POINTER_TTL_SECONDS * 1000,
  cacheMaxBytes: config.CACHE_MAX_BYTES,
  fileMaxAgeSeconds: config.FILE_MAX_AGE_SECONDS,
});
server.listen(config.PORT, config.HOST, () => {
  // oxlint-disable-next-line no-console -- startup line for container logs
  console.log(`games listening on ${config.HOST}:${config.PORT}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
