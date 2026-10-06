import {
  type GameManifest,
  manifestUrl,
  parseManifest,
  sdkRangeMajor,
} from '@croffledev/play-protocol';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { games } from '../db/schema.js';
import { assertRegistrable } from '../sdk/registrable.js';
import { SdkService } from '../sdk/sdk.service.js';
import { MANIFEST_FETCHER, ManifestFetchError, type ManifestFetcher } from './manifest-fetcher.js';

/**
 * Keeps each game's `game.json` (served by the game itself at `<origin>/game.json`) and decides
 * whether it may be listed: the SDK major it is built with must accept registrations (current or
 * lts — docs/sdk-lifecycle.md).
 */
@Injectable()
export class RegistryService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(SdkService) private readonly sdk: SdkService,
    @Inject(MANIFEST_FETCHER) private readonly fetchManifest: ManifestFetcher,
  ) {}

  /**
   * Fetches and checks `game.json`, then stores it. A failure is recorded on the game and thrown;
   * the previously stored manifest stays in place.
   */
  async refresh(id: string): Promise<GameManifest> {
    await this.requireGame(id);
    try {
      const manifest = await this.load(id);
      const major = sdkRangeMajor(manifest.sdk) as number;
      await this.requireRegistrable(major);
      await this.db
        .update(games)
        .set({ manifest, sdkMajor: major, manifestFetchedAt: new Date(), manifestError: null })
        .where(eq(games.id, id));
      return manifest;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.db.update(games).set({ manifestError: message }).where(eq(games.id, id));
      throw err instanceof UnprocessableEntityException
        ? err
        : new UnprocessableEntityException(message);
    }
  }

  /** Listing needs a stored manifest on a major that accepts registrations. */
  async assertListable(id: string): Promise<void> {
    const game = await this.requireGame(id);
    if (!game.manifest || game.sdkMajor === null) {
      throw new UnprocessableEntityException(
        `'${id}' has no game.json yet; refresh it once the game is online`,
      );
    }
    await this.requireRegistrable(game.sdkMajor);
  }

  private async load(id: string): Promise<GameManifest> {
    const url = manifestUrl(this.env.GAME_ORIGIN_TEMPLATE, id);
    let raw: unknown;
    try {
      raw = await this.fetchManifest(url, this.env.GAME_MANIFEST_TIMEOUT_MS);
    } catch (err) {
      throw new UnprocessableEntityException(
        err instanceof ManifestFetchError ? err.message : `${url}: ${String(err)}`,
      );
    }
    const parsed = parseManifest(raw);
    if (!parsed.ok) {
      const issues = parsed.issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ');
      throw new UnprocessableEntityException(`game.json is invalid: ${issues}`);
    }
    if (parsed.manifest.id !== id) {
      throw new UnprocessableEntityException(
        `game.json says id '${parsed.manifest.id}', but this game is '${id}'`,
      );
    }
    return parsed.manifest;
  }

  private requireRegistrable(major: number): Promise<void> {
    return assertRegistrable(this.sdk, this.env, major);
  }

  private async requireGame(id: string) {
    const [game] = await this.db.select().from(games).where(eq(games.id, id));
    if (!game) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return game;
  }
}
