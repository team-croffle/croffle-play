import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Db } from '../src/db/db.js';
import { gameVersions, games } from '../src/db/schema.js';
import { seed, seedGames } from '../src/db/seed.js';
import { createTestDb } from './support/test-db.js';

describe('schema + seed', () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
  });

  afterAll(async () => {
    await close();
  });

  it('seeds idempotently', async () => {
    await seed(db);
    await seed(db);
    expect(await db.select().from(games)).toHaveLength(seedGames.length);
    expect(await db.select().from(gameVersions)).toHaveLength(seedGames.length);
  });

  it('refuses a second row for the same game version', async () => {
    await expect(
      db.insert(gameVersions).values({ gameId: 'sample', version: '1.0.0', manifest: {} }),
    ).rejects.toThrow();
  });

  it('cascades versions when a game is deleted', async () => {
    await db.delete(games).where(eq(games.id, 'word-chain'));
    const rows = await db.select().from(gameVersions).where(eq(gameVersions.gameId, 'word-chain'));
    expect(rows).toHaveLength(0);
  });
});
