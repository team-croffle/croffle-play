import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import * as v from 'valibot';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { STORAGE, type Storage } from '../storage/storage.js';
import {
  ADAPTER_VERSION,
  adapterManifestSchema,
  adapterPath,
  publishAdapterDir,
} from './register-adapter.js';
import { SdkService } from './sdk.service.js';

/**
 * Registers the host adapter bundles shipped inside the api image (`ADAPTER_BUNDLE_DIR`, laid
 * out as `v<N>/<version>/{index.js,manifest.json}`) when the api starts — but only for a major
 * that has no adapter yet. It is the offline bootstrap; from then on the newest compatible
 * release from npm wins (AdapterSyncService), and an admin's choice is kept. Nothing here can
 * stop the api from starting.
 */
@Injectable()
export class AdapterBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdapterBootstrapService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(SdkService) private readonly sdk: SdkService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.env.ADAPTER_AUTO_REGISTER) {
      return;
    }
    try {
      const n = await this.register(this.env.ADAPTER_BUNDLE_DIR);
      if (n > 0) {
        this.logger.log(`Registered ${n} adapter bundle(s) from ${this.env.ADAPTER_BUNDLE_DIR}`);
      }
    } catch (err) {
      this.logger.error(`Adapter bootstrap failed: ${String(err)}`);
    }
  }

  /** Registers each bundle under `dir` whose major has no active adapter. Returns how many. */
  async register(dir: string): Promise<number> {
    let count = 0;
    for (const bundle of await this.bundles(dir)) {
      const target = adapterPath(bundle.major, bundle.version);
      const current = await this.sdk.find(bundle.major);
      if (current?.adapterUrl) {
        continue;
      }
      await publishAdapterDir(this.db, this.storage, bundle.dir, 'image');
      this.logger.log(`SDK v${bundle.major} → ${target}`);
      count += 1;
    }
    return count;
  }

  private async bundles(dir: string): Promise<{ major: number; version: string; dir: string }[]> {
    const majors = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const found: { major: number; version: string; dir: string }[] = [];
    for (const m of majors) {
      if (!m.isDirectory() || !/^v[1-9][0-9]{0,2}$/.test(m.name)) {
        continue;
      }
      for (const version of await readdir(join(dir, m.name)).catch(() => [])) {
        if (!ADAPTER_VERSION.test(version)) {
          continue; // `dev` builds are never registered from an image
        }
        const bundleDir = join(dir, m.name, version);
        const manifest = v.safeParse(
          adapterManifestSchema,
          JSON.parse(await readFile(join(bundleDir, 'manifest.json'), 'utf8').catch(() => 'null')),
        );
        if (manifest.success) {
          found.push({
            major: manifest.output.major,
            version: manifest.output.version,
            dir: bundleDir,
          });
        }
      }
    }
    return found;
  }
}
