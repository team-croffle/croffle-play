import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DB, type Db } from '../db/db.js';
import { gameVersions, games } from '../db/schema.js';

export type AdminGame = Omit<typeof games.$inferSelect, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export interface AdminVersion {
  version: string;
  status: (typeof gameVersions.$inferSelect)['status'];
  sdkMajor: number;
  uploadedAt: string | null;
  createdAt: string;
}

/** Game registry and release pointers. Rollback = moving `stable_version` (design invariant 2). */
@Injectable()
export class AdminGamesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: { id: string; name: string; description: string }): Promise<AdminGame> {
    const rows = await this.db.insert(games).values(input).onConflictDoNothing().returning();
    if (!rows[0]) {
      throw new ConflictException(`Game '${input.id}' already exists`);
    }
    return toGame(rows[0]);
  }

  async update(
    id: string,
    patch: {
      name?: string | undefined;
      description?: string | undefined;
      repo?: string | null | undefined;
      maxBundleBytes?: number | null | undefined;
    },
  ): Promise<AdminGame> {
    const rows = await this.db.update(games).set(patch).where(eq(games.id, id)).returning();
    if (!rows[0]) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return toGame(rows[0]);
  }

  async list(): Promise<AdminGame[]> {
    return (await this.db.select().from(games).orderBy(games.id)).map(toGame);
  }

  async get(id: string): Promise<AdminGame & { versions: AdminVersion[] }> {
    const [game] = await this.db.select().from(games).where(eq(games.id, id));
    if (!game) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    const versions = await this.db
      .select()
      .from(gameVersions)
      .where(eq(gameVersions.gameId, id))
      .orderBy(desc(gameVersions.createdAt));
    return {
      ...toGame(game),
      versions: versions.map((v) => ({
        version: v.version,
        status: v.status,
        sdkMajor: v.sdkMajor,
        uploadedAt: v.uploadedAt?.toISOString() ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }

  /** Uploaded (or previously approved) version → approved and stable. */
  async approve(id: string, version: string): Promise<AdminGame> {
    await this.requireStatus(id, version, ['uploaded', 'approved']);
    return this.db.transaction(async (tx) => {
      await tx
        .update(gameVersions)
        .set({ status: 'approved' })
        .where(and(eq(gameVersions.gameId, id), eq(gameVersions.version, version)));
      const [game] = await tx
        .update(games)
        .set({ stableVersion: version })
        .where(eq(games.id, id))
        .returning();
      return toGame(game as typeof games.$inferSelect);
    });
  }

  /** Uploaded version → rejected; clears the preview pointer if it pointed there. */
  async reject(id: string, version: string): Promise<AdminGame> {
    await this.requireStatus(id, version, ['uploaded']);
    return this.db.transaction(async (tx) => {
      await tx
        .update(gameVersions)
        .set({ status: 'rejected' })
        .where(and(eq(gameVersions.gameId, id), eq(gameVersions.version, version)));
      await tx
        .update(games)
        .set({ previewVersion: null })
        .where(and(eq(games.id, id), eq(games.previewVersion, version)));
      const [game] = await tx.select().from(games).where(eq(games.id, id));
      return toGame(game as typeof games.$inferSelect);
    });
  }

  /** Points stable back at an earlier approved version. Nothing is deleted or re-uploaded. */
  async rollback(id: string, version: string): Promise<AdminGame> {
    await this.requireStatus(id, version, ['approved']);
    const [game] = await this.db
      .update(games)
      .set({ stableVersion: version })
      .where(eq(games.id, id))
      .returning();
    return toGame(game as typeof games.$inferSelect);
  }

  private async requireStatus(id: string, version: string, allowed: AdminVersion['status'][]) {
    const [row] = await this.db
      .select({ status: gameVersions.status })
      .from(gameVersions)
      .where(and(eq(gameVersions.gameId, id), eq(gameVersions.version, version)));
    if (!row) {
      throw new NotFoundException(`Version ${version} of '${id}' not found`);
    }
    if (!allowed.includes(row.status)) {
      throw new ConflictException(`Version ${version} is ${row.status}`);
    }
  }
}

function toGame(row: typeof games.$inferSelect): AdminGame {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
