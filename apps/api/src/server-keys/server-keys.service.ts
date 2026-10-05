import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { randomToken, sha256Hex } from '../common/secret.js';
import { DB, type Db } from '../db/db.js';
import { games, serverKeys } from '../db/schema.js';

export type ServerKey = typeof serverKeys.$inferSelect;

const PREFIX = 'csk';

export interface ServerKeyView {
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/**
 * Per-game keys for the game's own server (`csk_<game>_<random>`): it submits verified scores with
 * them. Only the SHA-256 is stored; the raw key is shown once, at issue.
 */
@Injectable()
export class ServerKeysService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async issue(gameId: string, label = ''): Promise<{ key: string } & ServerKeyView> {
    await this.requireGame(gameId);
    const key = `${PREFIX}_${gameId}_${randomToken()}`;
    const [row] = await this.db
      .insert(serverKeys)
      .values({ gameId, keyHash: sha256Hex(key), prefix: key.slice(0, gameId.length + 11), label })
      .returning();
    return { key, ...toView(row as ServerKey) };
  }

  async list(gameId: string): Promise<ServerKeyView[]> {
    await this.requireGame(gameId);
    const rows = await this.db
      .select()
      .from(serverKeys)
      .where(eq(serverKeys.gameId, gameId))
      .orderBy(desc(serverKeys.createdAt));
    return rows.map(toView);
  }

  async revoke(gameId: string, id: string): Promise<void> {
    const rows = await this.db
      .update(serverKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(serverKeys.gameId, gameId), eq(serverKeys.id, id)))
      .returning({ id: serverKeys.id });
    if (rows.length === 0) {
      throw new NotFoundException('Server key not found');
    }
  }

  /**
   * Issues a replacement (same label) and lets the old key keep working for `graceHours` so the
   * game server's secret can be swapped without downtime.
   */
  async rotate(
    gameId: string,
    id: string,
    graceHours = 24,
  ): Promise<{ key: string } & ServerKeyView> {
    const [old] = await this.db
      .select()
      .from(serverKeys)
      .where(and(eq(serverKeys.gameId, gameId), eq(serverKeys.id, id)));
    if (!old || old.revokedAt) {
      throw new NotFoundException('Active server key not found');
    }
    const until = new Date(Date.now() + graceHours * 3_600_000);
    if (!old.expiresAt || old.expiresAt > until) {
      await this.db.update(serverKeys).set({ expiresAt: until }).where(eq(serverKeys.id, id));
    }
    return this.issue(gameId, old.label);
  }

  /** The active key row for a raw key, or null (unknown, revoked, expired). */
  async verify(raw: string): Promise<ServerKey | null> {
    if (!raw.startsWith(`${PREFIX}_`)) {
      return null;
    }
    const [row] = await this.db
      .select()
      .from(serverKeys)
      .where(eq(serverKeys.keyHash, sha256Hex(raw)));
    const now = Date.now();
    if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() <= now)) {
      return null;
    }
    await this.db
      .update(serverKeys)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(serverKeys.id, row.id));
    return row;
  }

  private async requireGame(gameId: string): Promise<void> {
    const [g] = await this.db.select({ id: games.id }).from(games).where(eq(games.id, gameId));
    if (!g) {
      throw new NotFoundException(`Game '${gameId}' not found`);
    }
  }
}

function toView(row: ServerKey): ServerKeyView {
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
