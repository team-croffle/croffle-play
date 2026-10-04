import {
  type GameManifest,
  parseManifest,
  sdkRangeMajor,
  THUMBNAIL,
} from '@croffledev/play-protocol';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { gameBaseUrl } from '../common/game-url.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DB, type Db } from '../db/db.js';
import { type BundleFile, gameVersions, games } from '../db/schema.js';
import { GameServersService } from '../game-servers/game-servers.service.js';
import { SdkService } from '../sdk/sdk.service.js';
import { STORAGE, type PresignedUpload, type Storage } from '../storage/storage.js';
import { contentTypeFor } from './content-type.js';
import {
  type CreateVersionBody,
  DEFAULT_MAX_BUNDLE_BYTES,
  UPLOAD_URL_TTL_SECONDS,
} from './publish.schemas.js';

export interface CreatedVersion {
  version: string;
  expiresAt: string;
  /** Things the author should act on (e.g. an SDK major nearing end of life). */
  warnings: string[];
  uploads: ({ path: string } & PresignedUpload)[];
}

/**
 * Publish flow (docs/ARCHITECTURE.md §5): declare a version → upload each file with its presigned
 * URL → complete. Versions are immutable once completed (design invariant 2).
 */
@Injectable()
export class PublishService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(SdkService) private readonly sdk: SdkService,
    @Inject(GameServersService) private readonly servers: GameServersService,
  ) {}

  async create(gameId: string, body: CreateVersionBody): Promise<CreatedVersion> {
    const manifest = this.manifest(gameId, body.manifest);
    const [game] = await this.db.select().from(games).where(eq(games.id, gameId));
    if (!game) {
      throw new NotFoundException(`Game '${gameId}' not found`);
    }
    const existing = await this.version(gameId, manifest.version);
    if (existing && existing.status !== 'pending') {
      throw new ConflictException(
        `Version ${manifest.version} already exists and cannot be replaced; publish a new version`,
      );
    }
    const { major: sdkMajor, warnings } = await this.checkSdk(manifest.sdk);
    const files = this.files(manifest, body.files, game.maxBundleBytes ?? DEFAULT_MAX_BUNDLE_BYTES);

    const values = { manifest: manifest as Record<string, unknown>, files, sdkMajor };
    await this.db
      .insert(gameVersions)
      .values({ gameId, version: manifest.version, status: 'pending', ...values })
      .onConflictDoUpdate({ target: [gameVersions.gameId, gameVersions.version], set: values });

    const uploads = await Promise.all(
      files.map(async (f) => ({
        path: f.path,
        ...(await this.storage.presignPut(
          {
            key: objectKey(gameId, manifest.version, f.path),
            contentType: f.contentType,
            contentLength: f.size,
            sha256: f.sha256,
            ...(f.contentEncoding ? { contentEncoding: f.contentEncoding } : {}),
          },
          UPLOAD_URL_TTL_SECONDS,
        )),
      })),
    );
    return {
      version: manifest.version,
      expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      warnings,
      uploads,
    };
  }

  async complete(
    gameId: string,
    version: string,
  ): Promise<{ version: string; previewUrl: string }> {
    const row = await this.version(gameId, version);
    if (!row) {
      throw new NotFoundException(`Version ${version} of '${gameId}' was never declared`);
    }
    if (row.status !== 'pending') {
      throw new ConflictException(`Version ${version} is already ${row.status}`);
    }
    const problems: { path: string; problem: string }[] = [];
    await Promise.all(
      (row.files ?? []).map(async (f) => {
        const stored = await this.storage.head(objectKey(gameId, version, f.path));
        if (!stored) {
          problems.push({ path: f.path, problem: 'missing' });
        } else if (stored.size !== f.size) {
          problems.push({ path: f.path, problem: `size ${stored.size} ≠ ${f.size}` });
        } else if (stored.sha256 !== f.sha256) {
          problems.push({ path: f.path, problem: 'checksum mismatch' });
        }
      }),
    );
    if (problems.length > 0) {
      throw new UnprocessableEntityException({ message: 'Upload incomplete', problems });
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(gameVersions)
        .set({ status: 'uploaded', uploadedAt: new Date() })
        .where(and(eq(gameVersions.gameId, gameId), eq(gameVersions.version, version)));
      await tx.update(games).set({ previewVersion: version }).where(eq(games.id, gameId));
    });
    await this.servers.onVersionUploaded(gameId, row.manifest as GameManifest);
    const entry = (row.manifest as { entry?: string }).entry ?? 'index.html';
    return {
      version,
      previewUrl: new URL(entry, gameBaseUrl(this.env.GAME_URL_TEMPLATE, gameId, version)).href,
    };
  }

  private manifest(gameId: string, input: unknown): GameManifest {
    const parsed = parseManifest(input);
    if (!parsed.ok) {
      throw new UnprocessableEntityException({
        message: 'Invalid game.json',
        issues: parsed.issues,
      });
    }
    if (parsed.manifest.id !== gameId) {
      throw new UnprocessableEntityException(
        `game.json id '${parsed.manifest.id}' does not match '${gameId}'`,
      );
    }
    return parsed.manifest;
  }

  /** SDK major of the bundle; refused when unknown, deprecated, or end-of-life. */
  private async checkSdk(range: string): Promise<{ major: number; warnings: string[] }> {
    const major = sdkRangeMajor(range) ?? 0;
    const info = await this.sdk.find(major);
    const guide = this.env.SDK_MIGRATION_GUIDE_URL;
    if (!info) {
      throw new UnprocessableEntityException(`SDK v${major} is not supported by the platform`);
    }
    const when = info.eolAt ? ` (end of life ${info.eolAt.slice(0, 10)})` : '';
    if (info.status === 'deprecated' || info.status === 'eol') {
      throw new UnprocessableEntityException(
        `SDK v${major} is ${info.status}${when}; new versions must use a supported SDK major. ` +
          `Migration guide: ${guide}`,
      );
    }
    const warnings =
      info.status === 'maintenance'
        ? [`SDK v${major} is in maintenance${when}; plan an upgrade: ${guide}`]
        : [];
    return { major, warnings };
  }

  private files(manifest: GameManifest, declared: CreateVersionBody['files'], limit: number) {
    const paths = new Set<string>();
    for (const f of declared) {
      if (paths.has(f.path)) {
        throw new UnprocessableEntityException(`Duplicate file '${f.path}'`);
      }
      paths.add(f.path);
    }
    for (const required of ['game.json', manifest.entry, manifest.thumbnail]) {
      if (!paths.has(required)) {
        throw new UnprocessableEntityException(`Bundle is missing '${required}'`);
      }
    }
    const thumb = declared.find((f) => f.path === manifest.thumbnail);
    const ext = manifest.thumbnail.split('.').pop()?.toLowerCase() ?? '';
    if (
      !(THUMBNAIL.extensions as readonly string[]).includes(ext) ||
      (thumb && thumb.size > THUMBNAIL.maxBytes)
    ) {
      throw new UnprocessableEntityException(
        `Thumbnail must be PNG, JPEG, or WebP and at most ${THUMBNAIL.maxBytes} bytes`,
      );
    }
    const total = declared.reduce((sum, f) => sum + f.size, 0);
    if (total > limit) {
      throw new PayloadTooLargeException(
        `Bundle is ${total} bytes; the limit for this game is ${limit} bytes`,
      );
    }
    return declared.map((f): BundleFile => ({
      path: f.path,
      size: f.size,
      sha256: f.sha256,
      contentType: f.contentType ?? contentTypeFor(f.path, f.contentEncoding),
      ...(f.contentEncoding ? { contentEncoding: f.contentEncoding } : {}),
    }));
  }

  private async version(gameId: string, version: string) {
    const [row] = await this.db
      .select()
      .from(gameVersions)
      .where(and(eq(gameVersions.gameId, gameId), eq(gameVersions.version, version)));
    return row;
  }
}

/** `<id>/<version>/<path>` in the games bucket — served as `<id>.<game domain>/<version>/<path>`. */
export function objectKey(gameId: string, version: string, path: string): string {
  return `${gameId}/${version}/${path}`;
}
