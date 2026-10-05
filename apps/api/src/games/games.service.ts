import { gameUrl } from '@croffledev/play-protocol';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { games, sdkVersions } from '../db/schema.js';
import { effectiveStatus, type SdkStatus } from '../sdk/lifecycle.js';

/** Public catalog entry. Only listed games are visible. */
export interface GameSummary {
  id: string;
  name: string;
  description: string;
  /** `<game origin>/<thumbnail>` from the game's `game.json`, if it declares one. */
  thumbnailUrl: string | null;
  /** Client↔server protocol, for games with their own server. */
  serverProtocol: string | null;
  /** Lifecycle of the SDK major the game is built with (from its `game.json`). */
  sdk: {
    major: number;
    status: SdkStatus;
    oldAt: string | null;
    deprecatedAt: string | null;
  } | null;
}

@Injectable()
export class GamesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(): Promise<GameSummary[]> {
    const rows = await this.listed().orderBy(asc(games.name));
    return rows.map((r) => this.toSummary(r));
  }

  async get(id: string): Promise<GameSummary> {
    const [row] = await this.listed().where(and(eq(games.id, id), eq(games.listed, true)));
    if (!row) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return this.toSummary(row);
  }

  private listed() {
    return this.db
      .select({ game: games, sdk: sdkVersions })
      .from(games)
      .leftJoin(sdkVersions, eq(sdkVersions.major, games.sdkMajor))
      .where(eq(games.listed, true))
      .$dynamic();
  }

  private toSummary(row: {
    game: typeof games.$inferSelect;
    sdk: typeof sdkVersions.$inferSelect | null;
  }): GameSummary {
    const manifest = row.game.manifest;
    return {
      id: row.game.id,
      name: row.game.name,
      description: row.game.description,
      thumbnailUrl: manifest?.thumbnail
        ? gameUrl(this.env.GAME_ORIGIN_TEMPLATE, row.game.id, manifest.thumbnail)
        : null,
      serverProtocol: manifest?.server?.protocol ?? null,
      sdk: row.sdk
        ? {
            major: row.sdk.major,
            status: effectiveStatus(row.sdk),
            oldAt: row.sdk.oldAt?.toISOString() ?? null,
            deprecatedAt: row.sdk.deprecatedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
}
