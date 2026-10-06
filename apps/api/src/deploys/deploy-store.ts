import type { GameManifest } from '@croffledev/play-protocol';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ne, sql } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { gameDeploys, games } from '../db/schema.js';
import { STORAGE, type Storage } from '../storage/storage.js';

export type DeployRow = typeof gameDeploys.$inferSelect;

export interface DeployView {
  id: string;
  gameId: string;
  active: boolean;
  size: number;
  fileCount: number;
  version: string | null;
  uploadedBy: string | null;
  deployKeyId: string | null;
  createdAt: string;
}

/** Storage key of one file of a deploy. */
export function deployKey(gameId: string, deployId: string, path: string): string {
  return `games/${gameId}/${deployId}/${path}`;
}

/** The pointer the game host reads: which deploy to serve. */
export function pointerKey(gameId: string): string {
  return `games/${gameId}/current.json`;
}

/** Rows and objects of platform-hosted deploys: the pointer switch, removal, pruning. */
@Injectable()
export class DeployStore {
  private readonly logger = new Logger(DeployStore.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(STORAGE) readonly storage: Storage,
  ) {}

  async insert(values: typeof gameDeploys.$inferInsert): Promise<DeployRow> {
    const [row] = await this.db.insert(gameDeploys).values(values).returning();
    return row as DeployRow;
  }

  /** Makes `deployId` the one served: manifest, SDK major, pointer in DB and storage. */
  async activate(
    gameId: string,
    deployId: string,
    manifest: GameManifest,
    major: number,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Serialize switches per game: two uploads at once end with one clear winner.
      await tx.execute(sql`SELECT 1 FROM games WHERE id = ${gameId} FOR UPDATE`);
      await tx
        .update(games)
        .set({
          hosting: 'platform',
          activeDeployId: deployId,
          manifest,
          sdkMajor: major,
          manifestFetchedAt: new Date(),
          manifestError: null,
        })
        .where(eq(games.id, gameId));
      await this.storage.put(pointerKey(gameId), {
        body: new TextEncoder().encode(JSON.stringify({ deployId, entry: manifest.entry })),
        contentType: 'application/json',
        cacheControl: 'no-cache',
      });
    });
  }

  /** Back to team hosting: nothing is served by the platform any more; deploys stay for later. */
  async deactivate(gameId: string): Promise<void> {
    await this.db
      .update(games)
      .set({ hosting: 'team', activeDeployId: null })
      .where(eq(games.id, gameId));
    await this.storage.delete([pointerKey(gameId)]);
  }

  /** Removes a deploy's files and row (after a failed upload, or when pruning old ones). */
  async discard(gameId: string, deployId: string): Promise<void> {
    try {
      const objects = await this.storage.list(deployKey(gameId, deployId, ''));
      await this.storage.delete(objects.map((o) => o.key));
    } catch (err) {
      this.logger.warn(`Could not remove files of deploy ${deployId}: ${String(err)}`);
    }
    await this.db.delete(gameDeploys).where(eq(gameDeploys.id, deployId));
  }

  /** Keeps the newest `keep` deploys (the active one always); removes the rest. */
  async prune(gameId: string, keep: number): Promise<void> {
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    const rows = await this.db
      .select({ id: gameDeploys.id })
      .from(gameDeploys)
      .where(and(eq(gameDeploys.gameId, gameId), ne(gameDeploys.id, game?.activeDeployId ?? '')))
      .orderBy(desc(gameDeploys.createdAt));
    const stale = rows.slice(Math.max(keep - 1, 0));
    for (const row of stale) {
      await this.discard(gameId, row.id).catch((err: unknown) =>
        this.logger.warn(`Pruning deploy ${row.id} failed: ${String(err)}`),
      );
    }
  }

  async list(gameId: string): Promise<DeployRow[]> {
    return this.db
      .select()
      .from(gameDeploys)
      .where(eq(gameDeploys.gameId, gameId))
      .orderBy(desc(gameDeploys.createdAt));
  }

  async find(gameId: string, deployId: string): Promise<DeployRow> {
    const [row] = await this.db
      .select()
      .from(gameDeploys)
      .where(and(eq(gameDeploys.gameId, gameId), eq(gameDeploys.id, deployId)));
    if (!row) {
      throw new NotFoundException(`Deploy '${deployId}' not found`);
    }
    return row;
  }

  async requireGame(id: string): Promise<typeof games.$inferSelect> {
    const [game] = await this.db.select().from(games).where(eq(games.id, id));
    if (!game) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return game;
  }

  view(row: DeployRow, activeDeployId: string | null): DeployView {
    return {
      id: row.id,
      gameId: row.gameId,
      active: row.id === activeDeployId,
      size: row.size,
      fileCount: row.fileCount,
      version: row.manifest.version ?? null,
      uploadedBy: row.uploadedBy,
      deployKeyId: row.deployKeyId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
