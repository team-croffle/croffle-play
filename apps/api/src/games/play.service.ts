import { gameUrl } from '@croffledev/play-protocol';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { games } from '../db/schema.js';

/**
 * What the shell needs to frame a game. The SDK major (and so the host adapter) is not known here:
 * the shell learns it from the game's `__hello`.
 */
export interface PlayInfo {
  id: string;
  name: string;
  /** Entry document on the game's own origin (`<origin>/<game.json entry>`). */
  url: string;
}

@Injectable()
export class PlayService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Listed games for everyone; `includeUnlisted` for admins previewing a game. */
  async info(id: string, opts: { includeUnlisted?: boolean } = {}): Promise<PlayInfo> {
    const [game] = await this.db.select().from(games).where(eq(games.id, id));
    if (!game || (!game.listed && !opts.includeUnlisted)) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return {
      id: game.id,
      name: game.name,
      url: gameUrl(this.env.GAME_ORIGIN_TEMPLATE, game.id, game.manifest?.entry ?? ''),
    };
  }
}
