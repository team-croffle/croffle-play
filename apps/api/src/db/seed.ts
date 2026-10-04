import type { Db } from './db.js';
import { gameVersions, games } from './schema.js';

/** Dummy catalog for local development. Idempotent. */
export const seedGames = [
  { id: 'sample', name: 'Sample', description: 'SDK handshake fixture.', version: '1.0.0' },
  { id: 'block-drop', name: 'Block Drop', description: 'Falling blocks.', version: '1.2.0' },
  { id: 'word-chain', name: 'Word Chain', description: 'Turn-based words.', version: '0.3.1' },
] as const;

export async function seed(db: Db): Promise<void> {
  for (const g of seedGames) {
    await db
      .insert(games)
      .values({ id: g.id, name: g.name, description: g.description, stableVersion: g.version })
      .onConflictDoNothing();
    await db
      .insert(gameVersions)
      .values({
        gameId: g.id,
        version: g.version,
        status: 'approved',
        manifest: { id: g.id, name: g.name, version: g.version, entry: 'index.html' },
        uploadedAt: new Date(),
      })
      .onConflictDoNothing();
  }
}
