import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { randomToken, sha256Hex } from '../common/secret.js';
import { DB, type Db } from '../db/db.js';
import { deployKeys, games } from '../db/schema.js';

export type DeployKey = typeof deployKeys.$inferSelect;

export interface DeployKeyView {
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/** Per-game publish keys (`cpk_<game>_<random>`). The raw key is shown once, at issue. */
@Injectable()
export class DeployKeysService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async issue(gameId: string, label = ''): Promise<{ key: string } & DeployKeyView> {
    await this.requireGame(gameId);
    const key = `cpk_${gameId}_${randomToken()}`;
    const [row] = await this.db
      .insert(deployKeys)
      .values({ gameId, keyHash: sha256Hex(key), prefix: key.slice(0, gameId.length + 11), label })
      .returning();
    return { key, ...toView(row as DeployKey) };
  }

  async list(gameId: string): Promise<DeployKeyView[]> {
    await this.requireGame(gameId);
    const rows = await this.db
      .select()
      .from(deployKeys)
      .where(eq(deployKeys.gameId, gameId))
      .orderBy(desc(deployKeys.createdAt));
    return rows.map(toView);
  }

  async revoke(gameId: string, id: string): Promise<void> {
    const rows = await this.db
      .update(deployKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(deployKeys.gameId, gameId), eq(deployKeys.id, id)))
      .returning({ id: deployKeys.id });
    if (rows.length === 0) {
      throw new NotFoundException('Deploy key not found');
    }
  }

  /** The active key row for a raw key, or null (unknown, revoked, expired). */
  async verify(raw: string): Promise<DeployKey | null> {
    if (!raw.startsWith('cpk_')) {
      return null;
    }
    const [row] = await this.db
      .select()
      .from(deployKeys)
      .where(eq(deployKeys.keyHash, sha256Hex(raw)));
    const now = Date.now();
    if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() <= now)) {
      return null;
    }
    await this.db
      .update(deployKeys)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(deployKeys.id, row.id));
    return row;
  }

  private async requireGame(gameId: string): Promise<void> {
    const [g] = await this.db.select({ id: games.id }).from(games).where(eq(games.id, gameId));
    if (!g) {
      throw new NotFoundException(`Game '${gameId}' not found`);
    }
  }
}

function toView(row: DeployKey): DeployKeyView {
  return {
    id: row.id,
    prefix: row.prefix,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}
