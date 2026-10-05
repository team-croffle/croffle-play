import type { GameManifest } from '@croffledev/play-protocol';

import type { Db } from './db.js';
import { games, sdkVersions } from './schema.js';

/**
 * Dummy catalog for local development. Idempotent. `sample` and `duo` exist as fixture games
 * (`pnpm dev:games`); the others only fill the catalog.
 */
export const seedGames = [
  { id: 'sample', name: 'Sample', description: 'SDK handshake fixture.' },
  { id: 'block-drop', name: 'Block Drop', description: 'Falling blocks.' },
  { id: 'word-chain', name: 'Word Chain', description: 'Turn-based words.' },
  { id: 'duo', name: 'Duo', description: 'Two-player rooms fixture.' },
] as const;

export async function seed(db: Db): Promise<void> {
  // Adapter URL/SRI come from `sdk:register` (or SEED_ADAPTER_MANIFEST_URL).
  await db.insert(sdkVersions).values({ major: 1, status: 'current' }).onConflictDoNothing();
  for (const g of seedGames) {
    const manifest: GameManifest = {
      id: g.id,
      name: g.name,
      sdk: '^1.0.0',
      entry: 'index.html',
      needsServer: false,
      orientation: 'any',
    };
    await db
      .insert(games)
      .values({ ...g, listed: true, manifest, sdkMajor: 1, manifestFetchedAt: new Date() })
      .onConflictDoNothing();
  }
}
