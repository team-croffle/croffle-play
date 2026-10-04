import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { games } from '../db/schema.js';

/** Public catalog entry. Only games with a stable version are visible. */
export interface GameSummary {
  id: string;
  name: string;
  description: string;
  version: string;
}

@Injectable()
export class GamesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(): Promise<GameSummary[]> {
    const rows = await this.db
      .select()
      .from(games)
      .where(isNotNull(games.stableVersion))
      .orderBy(asc(games.name));
    return rows.map(toSummary);
  }

  async get(id: string): Promise<GameSummary> {
    const [row] = await this.db
      .select()
      .from(games)
      .where(and(eq(games.id, id), isNotNull(games.stableVersion)));
    if (!row) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return toSummary(row);
  }
}

function toSummary(row: typeof games.$inferSelect): GameSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.stableVersion ?? '',
  };
}
