import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { createApp } from '../../src/bootstrap.js';
import type { Db } from '../../src/db/db.js';
import { seed } from '../../src/db/seed.js';
import { createTestDb, testEnv } from './test-db.js';

export interface TestApp {
  app: NestFastifyApplication;
  db: Db;
  close: () => Promise<void>;
}

/** App over a migrated PGlite database, optionally seeded. */
export async function createTestApp(
  opts: { seed?: boolean; env?: Record<string, string> } = {},
): Promise<TestApp> {
  const { db, close: closeDb } = await createTestDb();
  if (opts.seed) {
    await seed(db);
  }
  const app = await createApp({ env: testEnv(opts.env), db });
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
