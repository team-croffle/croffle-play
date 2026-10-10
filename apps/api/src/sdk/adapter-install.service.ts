import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import semver from 'semver';
import * as v from 'valibot';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { sdkAdapterVersions } from '../db/schema-sdk.js';
import { STORAGE, type Storage } from '../storage/storage.js';
import { PLAYABLE_STATUSES } from './lifecycle.js';
import { type AdapterRelease, compareVersions, NpmRegistry } from './npm-registry.js';
import { adapterManifestSchema, publishAdapterDir } from './register-adapter.js';
import { SdkService } from './sdk.service.js';

export interface AvailableAdapter extends AdapterRelease {
  /** Satisfies `requiresApi` for this api (`APP_VERSION`); dev builds accept everything. */
  compatible: boolean;
  installed: boolean;
}

export interface SyncResult {
  major: number;
  /** Version installed and activated now, or null when nothing newer and compatible exists. */
  installed: string | null;
  error?: string;
}

/**
 * Installs adapter releases from npm: downloads a version, checks npm's sha512 and the bundle's
 * own SRI, uploads it to storage and makes it the major's active adapter. `sync` does that for
 * the newest compatible release of every playable major ("newest compatible wins").
 */
@Injectable()
export class AdapterInstallService {
  private readonly logger = new Logger(AdapterInstallService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(SdkService) private readonly sdk: SdkService,
    @Inject(NpmRegistry) private readonly registry: NpmRegistry,
  ) {}

  /** Whether an adapter with this `requiresApi` range can talk to this api. */
  isCompatible(requiresApi: string | null): boolean {
    if (!requiresApi || this.env.APP_VERSION === 'dev' || !semver.valid(this.env.APP_VERSION)) {
      return true;
    }
    return semver.satisfies(this.env.APP_VERSION, requiresApi, { includePrerelease: true });
  }

  /** Releases on npm for the major, newest first, with compatibility and whether each is installed. */
  async available(major: number): Promise<AvailableAdapter[]> {
    const releases = await this.registry.releases(major);
    const installed = new Set(
      (
        await this.db
          .select({ version: sdkAdapterVersions.version })
          .from(sdkAdapterVersions)
          .where(eq(sdkAdapterVersions.major, major))
      ).map((r) => r.version),
    );
    return releases.map((r) => ({
      ...r,
      compatible: this.isCompatible(r.requiresApi),
      installed: installed.has(r.version),
    }));
  }

  /** Installs one release and makes it active. */
  async install(major: number, version: string, actor: string | null): Promise<void> {
    const release = (await this.registry.releases(major)).find((r) => r.version === version);
    if (!release) {
      throw new NotFoundException(`${version} of SDK v${major}'s adapter is not on npm`);
    }
    if (!this.isCompatible(release.requiresApi)) {
      throw new UnprocessableEntityException(
        `adapter ${version} needs api ${release.requiresApi}; this api is ${this.env.APP_VERSION}`,
      );
    }
    const files = await this.registry.bundle(release);
    const manifest = v.parse(
      adapterManifestSchema,
      JSON.parse(new TextDecoder().decode(files.manifest)),
    );
    if (manifest.major !== major || manifest.version !== version) {
      throw new UnprocessableEntityException(
        `the package says SDK v${manifest.major} ${manifest.version}, not v${major} ${version}`,
      );
    }
    const dir = await mkdtemp(join(tmpdir(), 'adapter-npm-'));
    try {
      await writeFile(join(dir, 'index.js'), files.index);
      await writeFile(join(dir, 'manifest.json'), files.manifest);
      // publishAdapterDir checks index.js against the manifest's SRI before anything is stored.
      await publishAdapterDir(this.db, this.storage, dir, 'npm', actor);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /**
   * For every playable major: install the newest release that is compatible and newer than the
   * active adapter. Never touches deprecated majors. Errors are per major, never thrown.
   */
  async sync(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const info of await this.sdk.list()) {
      if (!PLAYABLE_STATUSES.includes(info.status)) {
        continue;
      }
      try {
        const candidate = (await this.available(info.major)).find((r) => r.compatible);
        const active = await this.activeVersion(info.major, info.adapterUrl);
        if (!candidate || (active && compareVersions(candidate.version, active) <= 0)) {
          results.push({ major: info.major, installed: null });
          continue;
        }
        await this.install(info.major, candidate.version, null);
        this.logger.log(`SDK v${info.major}: adapter ${candidate.version} installed from npm`);
        results.push({ major: info.major, installed: candidate.version });
      } catch (err) {
        this.logger.warn(`SDK v${info.major}: adapter sync failed: ${String(err)}`);
        results.push({ major: info.major, installed: null, error: String(err) });
      }
    }
    return results;
  }

  /** Version string of the active adapter, from the recorded versions; null for dev or none. */
  private async activeVersion(major: number, adapterUrl: string | null): Promise<string | null> {
    if (!adapterUrl) {
      return null;
    }
    const [row] = await this.db
      .select({ version: sdkAdapterVersions.version, source: sdkAdapterVersions.source })
      .from(sdkAdapterVersions)
      .where(eq(sdkAdapterVersions.url, adapterUrl));
    return row && row.source !== 'dev' ? row.version : null;
  }
}
