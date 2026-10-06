import {
  type GameManifest,
  parseManifest,
  sdkRangeMajor,
  type UploadLimits,
} from '@croffledev/play-protocol';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { gameDeploys, games } from '../db/schema.js';
import { assertRegistrable } from '../sdk/registrable.js';
import { SdkService } from '../sdk/sdk.service.js';
import { STORAGE, type Storage } from '../storage/storage.js';
import { contentTypeFor } from './content-type.js';
import { readBuildZip, type ZipFile } from './zip-reader.js';

export interface DeployView {
  id: string;
  gameId: string;
  active: boolean;
  size: number;
  fileCount: number;
  version: string | null;
  uploadedBy: string | null;
  deployKeyId: string | null;
  createdAt: string;
}

export interface Uploader {
  userId?: string;
  deployKeyId?: string;
}

/** Storage key of one file of a deploy. */
export function deployKey(gameId: string, deployId: string, path: string): string {
  return `games/${gameId}/${deployId}/${path}`;
}

/** The pointer the game host reads: which deploy to serve. */
export function pointerKey(gameId: string): string {
  return `games/${gameId}/current.json`;
}

/**
 * Platform hosting: stores an uploaded build under `games/<id>/<deploy>/…` and points the game
 * at it. The zip's `game.json` becomes the game's manifest (it is not fetched from the origin).
 */
@Injectable()
export class DeployService {
  private readonly logger = new Logger(DeployService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(SdkService) private readonly sdk: SdkService,
  ) {}

  get limits(): UploadLimits {
    return {
      maxZipBytes: this.env.UPLOAD_MAX_ZIP_BYTES,
      maxTotalBytes: this.env.UPLOAD_MAX_TOTAL_BYTES,
      maxFiles: this.env.UPLOAD_MAX_FILES,
      maxFileBytes: this.env.UPLOAD_MAX_FILE_BYTES,
      maxPathLength: 255,
    };
  }

  async upload(gameId: string, zip: Uint8Array, by: Uploader): Promise<DeployView> {
    await this.requireGame(gameId);
    const files = await readBuildZip(zip, this.limits);
    const manifest = this.manifestOf(gameId, files);
    const major = sdkRangeMajor(manifest.sdk) as number;
    await assertRegistrable(this.sdk, this.env, major);

    const [row] = await this.db
      .insert(gameDeploys)
      .values({
        gameId,
        uploadedBy: by.userId ?? null,
        deployKeyId: by.deployKeyId ?? null,
        size: files.reduce((n, f) => n + f.body.byteLength, 0),
        fileCount: files.length,
        manifest,
      })
      .returning();
    const deploy = row as typeof gameDeploys.$inferSelect;
    try {
      for (const f of files) {
        await this.storage.put(deployKey(gameId, deploy.id, f.path), {
          body: f.body,
          contentType: contentTypeFor(f.path),
        });
      }
      await this.activate(gameId, deploy.id, manifest, major);
    } catch (err) {
      await this.discard(gameId, deploy.id);
      throw err;
    }
    return this.view(deploy, true);
  }

  /** Makes `deployId` the one served: manifest, SDK major, pointer in DB and storage. */
  protected async activate(
    gameId: string,
    deployId: string,
    manifest: GameManifest,
    major: number,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Serialize switches per game: two uploads at once end with one clear winner.
      await tx.execute(sql`SELECT 1 FROM games WHERE id = ${gameId} FOR UPDATE`);
      await tx
        .update(games)
        .set({
          hosting: 'platform',
          activeDeployId: deployId,
          manifest,
          sdkMajor: major,
          manifestFetchedAt: new Date(),
          manifestError: null,
        })
        .where(eq(games.id, gameId));
      await this.storage.put(pointerKey(gameId), {
        body: new TextEncoder().encode(JSON.stringify({ deployId, entry: manifest.entry })),
        contentType: 'application/json',
        cacheControl: 'no-cache',
      });
    });
  }

  /** Removes a deploy's files and row (after a failed upload, or when pruning old ones). */
  protected async discard(gameId: string, deployId: string): Promise<void> {
    try {
      const objects = await this.storage.list(`${deployKey(gameId, deployId, '')}`);
      await this.storage.delete(objects.map((o) => o.key));
    } catch (err) {
      this.logger.warn(`Could not remove files of deploy ${deployId}: ${String(err)}`);
    }
    await this.db.delete(gameDeploys).where(eq(gameDeploys.id, deployId));
  }

  private manifestOf(gameId: string, files: ZipFile[]): GameManifest {
    const file = files.find((f) => f.path === 'game.json');
    if (!file) {
      throw new UnprocessableEntityException('The build has no game.json at its root');
    }
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(file.body));
    } catch {
      throw new UnprocessableEntityException('game.json is not valid JSON');
    }
    const parsed = parseManifest(raw);
    if (!parsed.ok) {
      const issues = parsed.issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ');
      throw new UnprocessableEntityException(`game.json is invalid: ${issues}`);
    }
    if (parsed.manifest.id !== gameId) {
      throw new UnprocessableEntityException(
        `game.json says id '${parsed.manifest.id}', but this game is '${gameId}'`,
      );
    }
    if (!files.some((f) => f.path === parsed.manifest.entry)) {
      throw new UnprocessableEntityException(
        `game.json entry '${parsed.manifest.entry}' is not in the build`,
      );
    }
    return parsed.manifest;
  }

  protected view(row: typeof gameDeploys.$inferSelect, active: boolean): DeployView {
    return {
      id: row.id,
      gameId: row.gameId,
      active,
      size: row.size,
      fileCount: row.fileCount,
      version: row.manifest.version ?? null,
      uploadedBy: row.uploadedBy,
      deployKeyId: row.deployKeyId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  protected async requireGame(id: string) {
    const [game] = await this.db.select().from(games).where(eq(games.id, id));
    if (!game) {
      throw new NotFoundException(`Game '${id}' not found`);
    }
    return game;
  }
}

/** Only `application/zip` bodies reach the upload routes. */
export function requireZip(body: unknown): Uint8Array {
  if (!(body instanceof Uint8Array) || body.byteLength === 0) {
    throw new BadRequestException('Send the build as an application/zip body');
  }
  return body;
}
