import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { sdkVersionEvents, sdkVersions } from '../db/schema.js';
import {
  ACTIVE_STATUSES,
  effectiveStatus,
  MAX_ACTIVE_MAJORS,
  type SdkStatus,
} from './lifecycle.js';

export interface SdkTransition {
  major: number;
  from: SdkStatus;
  to: SdkStatus;
  deprecatedAt: Date | null;
  eolAt: Date | null;
}

export type TransitionListener = (t: SdkTransition) => Promise<void>;

/**
 * Brings stored statuses in line with their dates (hourly and at boot), records each transition,
 * and tells listeners (e.g. the GitHub notifier). Reads already use the effective status, so the
 * job only persists and announces what is already true.
 */
@Injectable()
export class SdkLifecycleService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SdkLifecycleService.name);
  private readonly listeners: TransitionListener[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onTransition(listener: TransitionListener): void {
    this.listeners.push(listener);
  }

  onApplicationBootstrap(): void {
    const seconds = this.env.SDK_LIFECYCLE_INTERVAL_SECONDS;
    if (seconds === 0) {
      return;
    }
    const run = () => {
      this.sync().catch((err: unknown) =>
        this.logger.error(`SDK lifecycle sync failed: ${String(err)}`),
      );
    };
    run();
    this.timer = setInterval(run, seconds * 1000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async sync(now: Date = new Date()): Promise<SdkTransition[]> {
    const rows = await this.db.select().from(sdkVersions);
    const transitions: SdkTransition[] = [];
    for (const row of rows) {
      const to = effectiveStatus(row, now);
      if (to === row.status) {
        continue;
      }
      const t = {
        major: row.major,
        from: row.status,
        to,
        deprecatedAt: row.deprecatedAt,
        eolAt: row.eolAt,
      };
      await this.db.transaction(async (tx) => {
        await tx.update(sdkVersions).set({ status: to }).where(eq(sdkVersions.major, row.major));
        await tx
          .insert(sdkVersionEvents)
          .values({ major: row.major, fromStatus: row.status, toStatus: to, at: now });
      });
      this.logger.log(`SDK v${row.major}: ${row.status} → ${to}`);
      transitions.push(t);
    }
    const active = rows.filter((r) => ACTIVE_STATUSES.includes(effectiveStatus(r, now)));
    if (active.length > MAX_ACTIVE_MAJORS) {
      this.logger.warn(
        `${active.length} SDK majors are active; policy allows ${MAX_ACTIVE_MAJORS}`,
      );
    }
    for (const t of transitions) {
      for (const listener of this.listeners) {
        await listener(t).catch((err: unknown) =>
          this.logger.error(`listener failed: ${String(err)}`),
        );
      }
    }
    return transitions;
  }
}
