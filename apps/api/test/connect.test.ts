import { describe, expect, it } from 'vitest';

import { connect } from '../src/db/connect.js';
import { games } from '../src/db/schema.js';
import { testEnv } from './support/test-db.js';

describe('connect', () => {
  it('runs an embedded pglite database with migrations and seed', async () => {
    const conn = await connect(
      testEnv({ DATABASE_URL: 'pglite://memory', DB_SEED: 'true', NODE_ENV: 'development' }),
    );
    try {
      expect(await conn.db.select().from(games)).toHaveLength(3);
    } finally {
      await conn.close();
    }
  });

  it('refuses pglite and seeding in production', async () => {
    await expect(
      connect(testEnv({ DATABASE_URL: 'pglite://memory', NODE_ENV: 'production' })),
    ).rejects.toThrow(/local development/);
  });
});
