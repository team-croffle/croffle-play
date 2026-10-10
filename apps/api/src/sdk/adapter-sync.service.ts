import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AdapterInstallService, type SyncResult } from './adapter-install.service.js';

export interface SyncStatus {
  /** Seconds between runs; 0 = off. */
  intervalSeconds: number;
  lastRunAt: string | null;
  lastResults: SyncResult[];
}

/**
 * Keeps every playable major on the newest compatible adapter from npm: once at boot (after the
 * image bundles) and every `ADAPTER_SYNC_INTERVAL_SECONDS`. 0 turns it off (air-gapped hosts use
 * the image bundles and `register-cli`).
 */
@Injectable()
export class AdapterSyncService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AdapterSyncService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastRunAt: Date | null = null;
  private lastResults: SyncResult[] = [];

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(AdapterInstallService) private readonly installer: AdapterInstallService,
  ) {}

  onApplicationBootstrap(): void {
    const seconds = this.env.ADAPTER_SYNC_INTERVAL_SECONDS;
    if (seconds === 0) {
      return;
    }
    const run = () => {
      this.runOnce().catch((err: unknown) =>
        this.logger.error(`Adapter sync failed: ${String(err)}`),
      );
    };
    run();
    this.timer = setInterval(run, seconds * 1000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async runOnce(): Promise<SyncResult[]> {
    this.lastResults = await this.installer.sync();
    this.lastRunAt = new Date();
    return this.lastResults;
  }

  status(): SyncStatus {
    return {
      intervalSeconds: this.env.ADAPTER_SYNC_INTERVAL_SECONDS,
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      lastResults: this.lastResults,
    };
  }
}
