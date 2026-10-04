import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { gameBaseUrl } from '../common/game-url.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { gameVersions, games } from '../db/schema.js';
import { type SdkInfo, SdkService } from '../sdk/sdk.service.js';

/** What the shell needs to start one game version. */
export interface PlayInfo {
  id: string;
  name: string;
  version: string;
  /** Entry document of the version (`<base>/<entry>`). */
  url: string;
  sdkMajor: number;
  /** Null when the bundle's SDK major is not registered (cannot be played). */
  sdk: SdkInfo | null;
}

@Injectable()
export class PlayService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(SdkService) private readonly sdk: SdkService,
  ) {}

  /**
   * Stable version by default. Players may also name the preview version; `anyVersion` (admins)
   * allows every uploaded version.
   */
  async info(id: string, version?: string, opts: { anyVersion?: boolean } = {}): Promise<PlayInfo> {
    const [game] = await this.db.select().from(games).where(eq(games.id, id));
    const target = version ?? game?.stableVersion;
    if (!game || !target || (version && !opts.anyVersion && version !== game.previewVersion)) {
      throw new NotFoundException(`No playable version of '${id}'`);
    }
    const [row] = await this.db
      .select()
      .from(gameVersions)
      .where(and(eq(gameVersions.gameId, id), eq(gameVersions.version, target)));
    if (!row || row.status === 'pending') {
      throw new NotFoundException(`No playable version of '${id}'`);
    }
    const entry = typeof row.manifest.entry === 'string' ? row.manifest.entry : 'index.html';
    return {
      id: game.id,
      name: game.name,
      version: row.version,
      url: new URL(entry, gameBaseUrl(this.env.GAME_URL_TEMPLATE, id, row.version)).href,
      sdkMajor: row.sdkMajor,
      sdk: await this.sdk.find(row.sdkMajor),
    };
  }
}
