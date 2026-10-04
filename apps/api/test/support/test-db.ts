import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { parseEnv, type Env } from '../../src/config/env.js';
import type { Db } from '../../src/db/db.js';
import { migrationsFolder } from '../../src/db/db.js';
import { schema } from '../../src/db/schema.js';

/** Fresh in-memory Postgres with the real migrations applied. */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db, close: () => client.close() };
}

export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://unused@localhost/test',
    SDK_LIFECYCLE_INTERVAL_SECONDS: '0',
    ...overrides,
  });
}
