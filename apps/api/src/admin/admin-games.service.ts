import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { games } from '../db/schema.js';
import { RegistryService } from './registry.service.js';

export type AdminGame = Omit<
  typeof games.$inferSelect,
  'createdAt' | 'updatedAt' | 'manifestFetchedAt'
> & {
  createdAt: string;
  updatedAt: string;
  manifestFetchedAt: string | null;
};

export interface GamePatch {
  name?: string | undefined;
  description?: string | undefined;
  listed?: boolean | undefined;
  repo?: string | null | undefined;
  scorePolicy?: 'client' | 'server' | undefined;
  scoreMin?: number | null | undefined;
  scoreMax?: number | null | undefined;
}

/**
 * Game registry. Games are hosted by their teams at `<id>.<games host>`; the platform keeps the
 * catalog entry, whether it is listed, and the game's `game.json` (RegistryService).
 */
@Injectable()
export class AdminGamesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(RegistryService) private readonly registry: RegistryService,
  ) {}

  /** Registers a game, unlisted. Its `game.json` is read now if the game is already online. */
  async create(input: { id: string; name: string; description: string }): Promise<AdminGame> {
    const rows = await this.db.insert(games).values(input).onConflictDoNothing().returning();
    if (!rows[0]) {
      throw new ConflictException(`Game '${input.id}' already exists`);
    }
    await this.registry.refresh(input.id).catch(() => undefined);
    return this.get(input.id);
  }

  async update(id: string, patch: GamePatch): Promise<AdminGame> {
    if (patch.listed) {
      await this.registry.assertListable(id);
    }
    const rows = await this.db.update(games).set(patch).where(eq(games.id, id)).returning();
    if (!rows[0]) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return toGame(rows[0]);
  }

  async refresh(id: string): Promise<AdminGame> {
    await this.registry.refresh(id);
    return this.get(id);
  }

  async list(): Promise<AdminGame[]> {
    return (await this.db.select().from(games).orderBy(games.id)).map(toGame);
  }

  async get(id: string): Promise<AdminGame> {
    const [game] = await this.db.select().from(games).where(eq(games.id, id));
    if (!game) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return toGame(game);
  }
}

function toGame(row: typeof games.$inferSelect): AdminGame {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    manifestFetchedAt: row.manifestFetchedAt?.toISOString() ?? null,
  };
}
