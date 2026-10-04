import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { parseEnv } from '../config/env.js';
import { schema } from './schema.js';
import { seed } from './seed.js';

const env = parseEnv(process.env);
const sql = postgres(env.DATABASE_URL, { max: 1 });
try {
  await seed(drizzle(sql, { schema }));
} finally {
  await sql.end();
}
