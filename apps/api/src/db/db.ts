import { fileURLToPath } from 'node:url';

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import type { schema } from './schema.js';

/** Drizzle database over any Postgres driver (postgres-js in prod, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Injection token for `Db`. */
export const DB = Symbol('DB');

/** `apps/api/drizzle`, resolved from both `src/db` and `dist/db`. */
export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
