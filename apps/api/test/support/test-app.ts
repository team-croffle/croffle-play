import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { createApp } from '../../src/bootstrap.js';
import type { Db } from '../../src/db/db.js';
import { seed } from '../../src/db/seed.js';
import type { Storage } from '../../src/storage/storage.js';
import { UsersService } from '../../src/users/users.service.js';
import { createTestDb, testEnv } from './test-db.js';
import { AUDIENCE, ISSUER, bearerFor, testJwks } from './test-issuer.js';

export interface TestApp {
  app: NestFastifyApplication;
  db: Db;
  /** Headers of a signed-in admin (`idp|admin`). */
  adminAuth: { authorization: string };
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
    env: testEnv({ OIDC_ISSUER: ISSUER, OIDC_AUDIENCE: AUDIENCE, ...opts.env }),
    db,
    jwks: testJwks,
    ...(opts.storage ? { storage: opts.storage } : {}),
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const users = app.get(UsersService);
  await users.ensure('idp|admin');
  await users.grantAdmin('idp|admin');
  return {
    app,
    db,
    adminAuth: await bearerFor('idp|admin'),
    close: async () => {
      await app.close();
      await closeDb();
    },
  };
}
