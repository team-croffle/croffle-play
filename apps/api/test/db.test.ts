import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Db } from '../src/db/db.js';
import { games, saves, users } from '../src/db/schema.js';
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

  it('seeds idempotently, listed and on SDK v1', async () => {
    await seed(db);
    await seed(db);
    const rows = await db.select().from(games);
    expect(rows).toHaveLength(seedGames.length);
    expect(rows.every((g) => g.listed && g.sdkMajor === 1 && g.manifest?.id === g.id)).toBe(true);
  });

  it('cascades player data when a game is deleted', async () => {
    const [user] = await db.insert(users).values({ sub: 'x', nickname: 'x' }).returning();
    await db.insert(saves).values({ gameId: 'word-chain', userId: user!.id, slot: 'a', data: '1' });
    await db.delete(games).where(eq(games.id, 'word-chain'));
    expect(await db.select().from(saves).where(eq(saves.gameId, 'word-chain'))).toHaveLength(0);
  });
});
