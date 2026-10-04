import type { GameManifest } from '@croffledev/play-protocol';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { gameServers, games } from '../db/schema.js';

export type GameServer = typeof gameServers.$inferSelect;

export interface GameServerView {
  gameId: string;
  gameName: string;
  image: string;
  protocol: string;
  status: GameServer['status'];
  requestedAt: string;
  approvedAt: string | null;
}

@Injectable()
export class GameServersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Called when a version finishes uploading. A new image or protocol needs (re-)approval; an
   * unchanged one keeps its status, including `revoked`.
   */
  async onVersionUploaded(gameId: string, manifest: GameManifest): Promise<void> {
    const image = manifest.server?.image;
    if (!manifest.needsServer || !image || !manifest.server) {
      return;
    }
    const protocol = manifest.server.protocol;
    const existing = await this.find(gameId);
    if (existing && existing.image === image && existing.protocol === protocol) {
      return;
    }
    const request = {
      image,
      protocol,
      status: 'requested' as const,
      requestedAt: new Date(),
      approvedAt: null,
      approvedBy: null,
    };
    await this.db
      .insert(gameServers)
      .values({ gameId, ...request })
      .onConflictDoUpdate({ target: gameServers.gameId, set: request });
  }

  async list(): Promise<GameServerView[]> {
    const rows = await this.db
      .select({ s: gameServers, name: games.name })
      .from(gameServers)
      .innerJoin(games, eq(games.id, gameServers.gameId))
      .orderBy(desc(gameServers.requestedAt));
    return rows.map((r) => toView(r.s, r.name));
  }

  async get(gameId: string): Promise<GameServer> {
    const row = await this.find(gameId);
    if (!row) {
      throw new NotFoundException(`'${gameId}' has no game server`);
    }
    return row;
  }

  async approve(gameId: string, adminId: string): Promise<GameServer> {
    const row = await this.get(gameId);
    if (row.status === 'approved') {
      throw new ConflictException('Already approved');
    }
    return this.update(gameId, { status: 'approved', approvedAt: new Date(), approvedBy: adminId });
  }

  async revoke(gameId: string): Promise<GameServer> {
    await this.get(gameId);
    return this.update(gameId, { status: 'revoked' });
  }

  /** What a game may learn about its own server: only once approved. */
  async publicInfo(gameId: string): Promise<{ url: string; protocol: string }> {
    const row = await this.find(gameId);
    if (row?.status !== 'approved') {
      throw new NotFoundException(`'${gameId}' has no approved game server`);
    }
    return {
      url: this.env.GAME_SERVER_URL_TEMPLATE.replaceAll('{id}', gameId),
      protocol: row.protocol,
    };
  }

  private async find(gameId: string): Promise<GameServer | undefined> {
    const [row] = await this.db.select().from(gameServers).where(eq(gameServers.gameId, gameId));
    return row;
  }

  private async update(gameId: string, set: Partial<GameServer>): Promise<GameServer> {
    const [row] = await this.db
      .update(gameServers)
      .set(set)
      .where(eq(gameServers.gameId, gameId))
      .returning();
    return row as GameServer;
  }
}

export function toView(s: GameServer, gameName: string): GameServerView {
  return {
    gameId: s.gameId,
    gameName,
    image: s.image,
    protocol: s.protocol,
    status: s.status,
    requestedAt: s.requestedAt.toISOString(),
    approvedAt: s.approvedAt?.toISOString() ?? null,
  };
}
