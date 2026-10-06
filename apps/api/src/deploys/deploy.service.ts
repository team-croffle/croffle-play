import {
  type GameManifest,
  parseManifest,
  sdkRangeMajor,
  type UploadLimits,
} from '@croffledev/play-protocol';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { assertRegistrable } from '../sdk/registrable.js';
import { SdkService } from '../sdk/sdk.service.js';
import { contentTypeFor } from './content-type.js';
import { deployKey, DeployStore, type DeployView } from './deploy-store.js';
import { readBuildZip, type ZipFile } from './zip-reader.js';

export type { DeployView } from './deploy-store.js';

export interface Uploader {
  userId?: string;
  deployKeyId?: string;
}

/**
 * Platform hosting: stores an uploaded build under `games/<id>/<deploy>/…` and points the game
 * at it. The zip's `game.json` becomes the game's manifest (it is not fetched from the origin).
 */
@Injectable()
export class DeployService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(SdkService) private readonly sdk: SdkService,
    @Inject(DeployStore) private readonly store: DeployStore,
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
    await this.store.requireGame(gameId);
    const files = await readBuildZip(zip, this.limits);
    const manifest = this.manifestOf(gameId, files);
    const major = sdkRangeMajor(manifest.sdk) as number;
    await assertRegistrable(this.sdk, this.env, major);

    const deploy = await this.store.insert({
      gameId,
      uploadedBy: by.userId ?? null,
      deployKeyId: by.deployKeyId ?? null,
      size: files.reduce((n, f) => n + f.body.byteLength, 0),
      fileCount: files.length,
      manifest,
    });
    try {
      for (const f of files) {
        await this.store.storage.put(deployKey(gameId, deploy.id, f.path), {
          body: f.body,
          contentType: contentTypeFor(f.path),
        });
      }
      await this.store.activate(gameId, deploy.id, manifest, major);
    } catch (err) {
      await this.store.discard(gameId, deploy.id);
      throw err;
    }
    await this.store.prune(gameId, this.env.DEPLOY_KEEP);
    return this.store.view(deploy, deploy.id);
  }

  async list(gameId: string): Promise<DeployView[]> {
    const game = await this.store.requireGame(gameId);
    return (await this.store.list(gameId)).map((r) => this.store.view(r, game.activeDeployId));
  }

  /** Rollback (or roll forward): serve an earlier upload again. Its SDK major must still register. */
  async rollback(gameId: string, deployId: string): Promise<DeployView> {
    await this.store.requireGame(gameId);
    const deploy = await this.store.find(gameId, deployId);
    const major = sdkRangeMajor(deploy.manifest.sdk) as number;
    await assertRegistrable(this.sdk, this.env, major);
    await this.store.activate(gameId, deploy.id, deploy.manifest, major);
    return this.store.view(deploy, deploy.id);
  }

  /**
   * `team` → the team serves the game again (`game.json` is read from the origin on the next
   * refresh); `platform` → the newest upload is served (there must be one).
   */
  async setHosting(gameId: string, hosting: 'team' | 'platform'): Promise<void> {
    const game = await this.store.requireGame(gameId);
    if (game.hosting === hosting) {
      return;
    }
    if (hosting === 'team') {
      await this.store.deactivate(gameId);
      return;
    }
    const [latest] = await this.store.list(gameId);
    if (!latest) {
      throw new ConflictException(
        `Upload a build of '${gameId}' before switching to platform hosting`,
      );
    }
    await this.rollback(gameId, latest.id);
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
}

/** Only `application/zip` bodies reach the upload routes. */
export function requireZip(body: unknown): Uint8Array {
  if (!(body instanceof Uint8Array) || body.byteLength === 0) {
    throw new BadRequestException('Send the build as an application/zip body');
  }
  return body;
}
