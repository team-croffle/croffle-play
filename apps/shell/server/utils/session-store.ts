import { createStorage, type Storage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';

let store: Storage | null | undefined;

/**
 * Where session data lives when `NUXT_SESSION_REDIS_URL` is set (any Redis-protocol server, e.g.
 * Valkey): the cookie then carries only a sealed session id. Null means the sealed cookie holds
 * the data itself.
 */
export function sessionStore(): Storage | null {
  if (store === undefined) {
    const url = useRuntimeConfig().sessionRedisUrl;
    store = url ? createStorage({ driver: redisDriver({ url, base: 'cp:sess' }) }) : null;
  }
  return store;
}

/** Tests: use this storage (or the cookie only, with null). */
export function setSessionStore(s: Storage | null): void {
  store = s;
}
