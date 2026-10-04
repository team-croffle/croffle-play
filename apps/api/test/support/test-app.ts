import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { createApp } from '../../src/bootstrap.js';
import type { Db } from '../../src/db/db.js';
import { seed } from '../../src/db/seed.js';
import type { Storage } from '../../src/storage/storage.js';
import { createTestDb, testEnv } from './test-db.js';

/** Admin bearer token every test app accepts. */
export const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef0123';
export const adminAuth = { authorization: `Bearer ${ADMIN_TOKEN}` };

export interface TestApp {
  app: NestFastifyApplication;
  db: Db;
  close: () => Promise<void>;
}

/** App over a migrated PGlite database, optionally seeded. */
export async function createTestApp(
  opts: { seed?: boolean; env?: Record<string, string>; storage?: Storage } = {},
): Promise<TestApp> {
  const { db, close: closeDb } = await createTestDb();
  if (opts.seed) {
    await seed(db);
  }
  const app = await createApp({
    env: testEnv({ ADMIN_TOKEN, ...opts.env }),
    db,
    ...(opts.storage ? { storage: opts.storage } : {}),
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return {
    app,
    db,
    close: async () => {
      await app.close();
      await closeDb();
    },
  };
}
