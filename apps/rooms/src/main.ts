import { remoteVerifier } from './auth.js';
import { parseConfig } from './config.js';
import { createRoomsServer } from './server.js';

const config = parseConfig(process.env);
const rooms = createRoomsServer({
  verify: remoteVerifier(config.JWKS_URL, config.TOKEN_ISSUER),
  originTemplate: config.ALLOWED_ORIGIN_TEMPLATE,
});
rooms.http.listen(config.PORT, config.HOST, () => {
  // oxlint-disable-next-line no-console -- startup line for container logs
  console.log(`rooms listening on ${config.HOST}:${config.PORT}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void rooms.close().then(() => process.exit(0));
  });
}
