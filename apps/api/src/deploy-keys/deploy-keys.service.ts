import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import {
  type GameKeyView,
  graceUntil,
  hasKind,
  isActiveKey,
  newGameKey,
  toKeyView,
} from '../common/game-keys.js';
import { sha256Hex } from '../common/secret.js';
import { DB, type Db } from '../db/db.js';
import { deployKeys, games } from '../db/schema.js';

export type DeployKey = typeof deployKeys.$inferSelect;
export type DeployKeyView = GameKeyView;

const KIND = 'cdk';

/**
 * Per-game keys for uploading builds without a browser session (`cdk_<game>_<random>`): a game
 * repository's CI or `play-cli deploy` uses one. A key uploads to its own game only. Only the
 * SHA-256 is stored; the raw key is shown once, at issue.
 */
@Injectable()
export class DeployKeysService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async issue(gameId: string, label = ''): Promise<{ key: string } & DeployKeyView> {
    await this.requireGame(gameId);
    const { key, row } = newGameKey(KIND, gameId, label);
    const [inserted] = await this.db
      .insert(deployKeys)
      .values({ gameId, ...row })
      .returning();
    return { key, ...toKeyView(inserted as DeployKey) };
  }

  async list(gameId: string): Promise<DeployKeyView[]> {
    await this.requireGame(gameId);
    const rows = await this.db
      .select()
      .from(deployKeys)
      .where(eq(deployKeys.gameId, gameId))
      .orderBy(desc(deployKeys.createdAt));
    return rows.map(toKeyView);
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

  /** A replacement (same label); the old key keeps working for `graceHours` while CI is updated. */
  async rotate(
    gameId: string,
    id: string,
    graceHours = 24,
  ): Promise<{ key: string } & DeployKeyView> {
    const [old] = await this.db
      .select()
      .from(deployKeys)
      .where(and(eq(deployKeys.gameId, gameId), eq(deployKeys.id, id)));
    if (!old || old.revokedAt) {
      throw new NotFoundException('Active deploy key not found');
    }
    const until = graceUntil(graceHours);
    if (!old.expiresAt || old.expiresAt > until) {
      await this.db.update(deployKeys).set({ expiresAt: until }).where(eq(deployKeys.id, id));
    }
    return this.issue(gameId, old.label);
  }

  /** The active key row for a raw key, or null (unknown kind, revoked, expired). */
  async verify(raw: string): Promise<DeployKey | null> {
    if (!hasKind(raw, KIND)) {
      return null;
    }
    const [row] = await this.db
      .select()
      .from(deployKeys)
      .where(eq(deployKeys.keyHash, sha256Hex(raw)));
    const now = Date.now();
    if (!row || !isActiveKey(row, now)) {
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
