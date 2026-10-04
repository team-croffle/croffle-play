import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import type { Env } from '../config/env.js';
import { fetchAdapterManifest, registerAdapter } from '../sdk/register-adapter.js';
import { type Db, migrationsFolder } from './db.js';
import { schema } from './schema.js';
import { seed } from './seed.js';

export interface Connection {
  db: Db;
  close: () => Promise<void>;
}

/**
 * Opens the database named by `DATABASE_URL`. `pglite://memory` (or `pglite:///<dir>`) runs an
 * embedded Postgres for local development without Docker; it is refused in production.
 */
export async function connect(env: Env): Promise<Connection> {
  const conn = env.DATABASE_URL.startsWith('pglite:')
    ? await connectPglite(env)
    : connectPostgres(env);
  if (env.DB_MIGRATE) {
    await conn.migrate();
  }
  if (env.DB_SEED) {
    if (env.NODE_ENV === 'production') {
      throw new Error('DB_SEED is not allowed in production');
    }
    await seed(conn.db);
    if (env.SEED_ADAPTER_MANIFEST_URL) {
      const url = env.SEED_ADAPTER_MANIFEST_URL;
      await registerAdapter(conn.db, await fetchAdapterManifest(url), url);
    }
  }
  return { db: conn.db, close: conn.close };
}

function connectPostgres(env: Env) {
  const sql = postgres(env.DATABASE_URL, { max: env.DB_POOL_SIZE });
  const db = drizzle(sql, { schema });
  return {
    db,
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => sql.end({ timeout: 5 }),
  };
}

async function connectPglite(env: Env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('pglite: databases are for local development only');
  }
  // Dev dependencies, loaded only on this path.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const { migrate: migratePglite } = await import('drizzle-orm/pglite/migrator');
  const url = new URL(env.DATABASE_URL);
  const client = new PGlite(url.host === 'memory' ? undefined : url.pathname);
  const db = drizzlePglite(client, { schema });
  return {
    db,
    migrate: () => migratePglite(db, { migrationsFolder }),
    close: () => client.close(),
  };
}
