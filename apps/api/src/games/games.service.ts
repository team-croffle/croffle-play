import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { gameVersions, games } from '../db/schema.js';

/** Public catalog entry. Only games with a stable version are visible. */
export interface GameSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  /** Client↔server protocol of the stable version, for games with their own server. */
  serverProtocol: string | null;
}

@Injectable()
export class GamesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(): Promise<GameSummary[]> {
    const rows = await this.stable().orderBy(asc(games.name));
    return rows.map(toSummary);
  }

  async get(id: string): Promise<GameSummary> {
    const [row] = await this.stable().where(and(eq(games.id, id), isNotNull(games.stableVersion)));
    if (!row) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return toSummary(row);
  }

  /** Games with a stable version, joined with that version's manifest. */
  private stable() {
    return this.db
      .select({ game: games, manifest: gameVersions.manifest })
      .from(games)
      .innerJoin(
        gameVersions,
        and(eq(gameVersions.gameId, games.id), eq(gameVersions.version, games.stableVersion)),
      )
      .$dynamic();
  }
}

function toSummary(row: {
  game: typeof games.$inferSelect;
  manifest: Record<string, unknown>;
}): GameSummary {
  const server = row.manifest.server as { protocol?: unknown } | undefined;
  return {
    id: row.game.id,
    name: row.game.name,
    description: row.game.description,
    version: row.game.stableVersion ?? '',
    serverProtocol: typeof server?.protocol === 'string' ? server.protocol : null,
  };
}
