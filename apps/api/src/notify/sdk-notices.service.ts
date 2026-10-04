import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { and, eq, inArray, isNotNull, or } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { gameVersions, games, sdkNotifications } from '../db/schema.js';
import { SdkLifecycleService, type SdkTransition } from '../sdk/lifecycle.service.js';
import { NOTIFIER, type Notifier } from './notifier.js';

/**
 * When a major becomes deprecated or end-of-life, tells every game still on it — once per game,
 * major, and status — through the configured notifier.
 */
@Injectable()
export class SdkNoticesService implements OnModuleInit {
  private readonly logger = new Logger(SdkNoticesService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
    @Inject(SdkLifecycleService) private readonly lifecycle: SdkLifecycleService,
  ) {}

  onModuleInit(): void {
    this.lifecycle.onTransition(async (t) => {
      await this.onTransition(t);
    });
  }

  async onTransition(t: SdkTransition): Promise<number> {
    if (t.to !== 'deprecated' && t.to !== 'eol') {
      return 0;
    }
    const affected = await this.gamesOn(t.major);
    let sent = 0;
    for (const game of affected) {
      const claimed = await this.db
        .insert(sdkNotifications)
        .values({ gameId: game.id, major: t.major, kind: t.to })
        .onConflictDoNothing()
        .returning();
      if (claimed.length === 0) {
        continue;
      }
      try {
        await this.notifier.notify({
          game,
          major: t.major,
          status: t.to,
          eolAt: t.eolAt,
          guideUrl: this.env.SDK_MIGRATION_GUIDE_URL,
        });
        sent++;
      } catch (err) {
        // Release the claim so a later transition run can try again.
        await this.db
          .delete(sdkNotifications)
          .where(
            and(
              eq(sdkNotifications.gameId, game.id),
              eq(sdkNotifications.major, t.major),
              eq(sdkNotifications.kind, t.to),
            ),
          );
        this.logger.error(`notice for ${game.id} failed: ${String(err)}`);
      }
    }
    return sent;
  }

  /** Games with a repository whose stable or preview version uses this major. */
  private async gamesOn(major: number) {
    const versions = this.db
      .select({ gameId: gameVersions.gameId })
      .from(gameVersions)
      .innerJoin(games, eq(games.id, gameVersions.gameId))
      .where(
        and(
          eq(gameVersions.sdkMajor, major),
          or(
            eq(gameVersions.version, games.stableVersion),
            eq(gameVersions.version, games.previewVersion),
          ),
        ),
      );
    const rows = await this.db
      .select({ id: games.id, name: games.name, repo: games.repo })
      .from(games)
      .where(and(isNotNull(games.repo), inArray(games.id, versions)));
    return rows.map((r) => ({ id: r.id, name: r.name, repo: r.repo as string }));
  }
}
