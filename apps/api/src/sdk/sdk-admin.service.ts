import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { sdkAdapterVersions, sdkAdminEvents } from '../db/schema-sdk.js';
import { sdkVersions } from '../db/schema.js';
import { STORAGE, type Storage } from '../storage/storage.js';
import {
  AdapterInstallService,
  type AvailableAdapter,
  type SyncResult,
} from './adapter-install.service.js';
import { AdapterSyncService, type SyncStatus } from './adapter-sync.service.js';
import { effectiveStatus, type SdkStatus } from './lifecycle.js';
import { SdkLifecycleService } from './lifecycle.service.js';
import { registerAdapter } from './register-adapter.js';
import { type SdkInfo, SdkService } from './sdk.service.js';

export interface AdapterVersionView {
  version: string;
  url: string;
  sri: string;
  source: 'image' | 'cli' | 'dev' | 'npm';
  registeredAt: string;
  active: boolean;
}

export interface SdkAdminEventView {
  id: string;
  kind: 'adapter_activated' | 'adapter_removed' | 'status_changed' | 'schedule_changed';
  from: Record<string, unknown> | null;
  to: Record<string, unknown>;
  actor: string | null;
  at: string;
}

export interface SdkDetail extends SdkInfo {
  adapters: AdapterVersionView[];
  events: SdkAdminEventView[];
  /** Releases on npm, newest first; null when the registry could not be read (`availableError`). */
  available: AvailableAdapter[] | null;
  availableError: string | null;
  /** The periodic install of the newest compatible release. */
  sync: SyncStatus;
}

export interface LifecyclePatch {
  status?: SdkStatus | undefined;
  oldAt?: string | null | undefined;
  deprecatedAt?: string | null | undefined;
  /** Required to deprecate: the major number, typed again. */
  confirm?: number | undefined;
}

const ORDER: SdkStatus[] = ['current', 'lts', 'old', 'deprecated'];

/**
 * What admins change about a major: which registered adapter is active, and its lifecycle
 * (status and dates — forward only; `deprecated` stops games and cannot be undone). Every change
 * is recorded in `sdk_admin_events` with its actor.
 */
@Injectable()
export class SdkAdminService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(SdkService) private readonly sdk: SdkService,
    @Inject(SdkLifecycleService) private readonly lifecycle: SdkLifecycleService,
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(AdapterInstallService) private readonly installer: AdapterInstallService,
    @Inject(AdapterSyncService) private readonly syncJob: AdapterSyncService,
  ) {}

  async detail(major: number): Promise<SdkDetail> {
    const info = await this.sdk.get(major);
    const adapters = await this.db
      .select()
      .from(sdkAdapterVersions)
      .where(eq(sdkAdapterVersions.major, major))
      .orderBy(desc(sdkAdapterVersions.registeredAt));
    const events = await this.db
      .select()
      .from(sdkAdminEvents)
      .where(eq(sdkAdminEvents.major, major))
      .orderBy(desc(sdkAdminEvents.at))
      .limit(50);
    let available: AvailableAdapter[] | null = null;
    let availableError: string | null = null;
    try {
      available = await this.installer.available(major);
    } catch (err) {
      availableError = err instanceof Error ? err.message : String(err);
    }
    return {
      ...info,
      adapters: adapters.map((a) => ({
        version: a.version,
        url: a.url,
        sri: a.sri,
        source: a.source,
        registeredAt: a.registeredAt.toISOString(),
        active: a.url === info.adapterUrl,
      })),
      events: events.map((e) => ({
        id: e.id,
        kind: e.kind,
        from: e.from ?? null,
        to: e.to,
        actor: e.actor,
        at: e.at.toISOString(),
      })),
      available,
      availableError,
      sync: this.syncJob.status(),
    };
  }

  /** Installs a release from npm and makes it active (the next sync may move on to a newer one). */
  async installAdapter(major: number, version: string, actor: string): Promise<SdkDetail> {
    await this.sdk.get(major);
    await this.installer.install(major, version, actor);
    return this.detail(major);
  }

  /** Removes an inactive registered version: its files and its record. */
  async removeAdapter(major: number, version: string, actor: string): Promise<SdkDetail> {
    const info = await this.sdk.get(major);
    const [row] = await this.db
      .select()
      .from(sdkAdapterVersions)
      .where(and(eq(sdkAdapterVersions.major, major), eq(sdkAdapterVersions.version, version)));
    if (!row) {
      throw new NotFoundException(`SDK v${major} has no registered adapter ${version}`);
    }
    if (row.url === info.adapterUrl) {
      throw new ConflictException(`adapter ${version} is active; activate another one first`);
    }
    if (row.url.startsWith('/adapters/')) {
      await this.storage.delete([row.url.replace(/^\//, '')]);
    }
    await this.db.transaction(async (tx) => {
      await tx
        .delete(sdkAdapterVersions)
        .where(and(eq(sdkAdapterVersions.major, major), eq(sdkAdapterVersions.version, version)));
      await tx.insert(sdkAdminEvents).values({
        major,
        kind: 'adapter_removed',
        from: { version, source: row.source },
        to: {},
        actor,
      });
    });
    return this.detail(major);
  }

  /** Runs the npm sync now. */
  syncNow(): Promise<SyncResult[]> {
    return this.syncJob.runOnce();
  }

  /** Serves a registered bundle (not a dev one) again; the next sync may move on to a newer one. */
  async activateAdapter(major: number, version: string, actor: string): Promise<SdkDetail> {
    await this.sdk.get(major);
    const [row] = await this.db
      .select()
      .from(sdkAdapterVersions)
      .where(and(eq(sdkAdapterVersions.major, major), eq(sdkAdapterVersions.version, version)));
    if (!row || row.source === 'dev') {
      throw new NotFoundException(`SDK v${major} has no registered adapter ${version}`);
    }
    await registerAdapter(
      this.db,
      { major, version: row.version, file: 'index.js', integrity: row.sri },
      row.url,
      row.source,
      actor,
    );
    return this.detail(major);
  }

  /**
   * Moves the lifecycle forward (`current → lts → old → deprecated`) or sets the dates that will.
   * Deprecating needs `confirm: <major>`; nothing here ever moves backwards.
   */
  async setLifecycle(major: number, patch: LifecyclePatch, actor: string): Promise<SdkDetail> {
    const [row] = await this.db.select().from(sdkVersions).where(eq(sdkVersions.major, major));
    if (!row) {
      throw new NotFoundException(`SDK v${major} is not registered`);
    }
    const now = new Date();
    const before = effectiveStatus(row, now);
    const next = {
      status: patch.status ?? row.status,
      oldAt: patch.oldAt === undefined ? row.oldAt : patch.oldAt && new Date(patch.oldAt),
      deprecatedAt:
        patch.deprecatedAt === undefined
          ? row.deprecatedAt
          : patch.deprecatedAt && new Date(patch.deprecatedAt),
    };
    if (patch.status && ORDER.indexOf(patch.status) < ORDER.indexOf(before)) {
      throw new UnprocessableEntityException(
        `SDK v${major} is ${before}; the lifecycle only moves forward`,
      );
    }
    if (
      before === 'deprecated' &&
      (patch.oldAt !== undefined || patch.deprecatedAt !== undefined)
    ) {
      throw new UnprocessableEntityException(`SDK v${major} is deprecated; nothing to schedule`);
    }
    if (next.oldAt && next.deprecatedAt && next.oldAt > next.deprecatedAt) {
      throw new BadRequestException('old_at must not be later than deprecated_at');
    }
    const after = effectiveStatus(
      { ...next, oldAt: next.oldAt || null, deprecatedAt: next.deprecatedAt || null },
      now,
    );
    if (after === 'deprecated' && before !== 'deprecated' && patch.confirm !== major) {
      throw new BadRequestException(
        `Deprecating SDK v${major} stops every game built on it and cannot be undone; send confirm: ${major}`,
      );
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(sdkVersions)
        .set({
          status: next.status,
          oldAt: next.oldAt || null,
          deprecatedAt: next.deprecatedAt || null,
        })
        .where(eq(sdkVersions.major, major));
      if (patch.status && patch.status !== row.status) {
        await tx.insert(sdkAdminEvents).values({
          major,
          kind: 'status_changed',
          from: { status: row.status },
          to: { status: patch.status },
          actor,
        });
      }
      if (patch.oldAt !== undefined || patch.deprecatedAt !== undefined) {
        await tx.insert(sdkAdminEvents).values({
          major,
          kind: 'schedule_changed',
          from: {
            oldAt: row.oldAt?.toISOString() ?? null,
            deprecatedAt: row.deprecatedAt?.toISOString() ?? null,
          },
          to: {
            oldAt: next.oldAt ? next.oldAt.toISOString() : null,
            deprecatedAt: next.deprecatedAt ? next.deprecatedAt.toISOString() : null,
          },
          actor,
        });
      }
    });
    // Persist what the dates already imply and tell the games (GitHub notices).
    await this.lifecycle.sync(now);
    return this.detail(major);
  }
}
