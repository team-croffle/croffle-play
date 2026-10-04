import {
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ServiceUnavailableException } from '@nestjs/common';

import type { Env } from '../config/env.js';
import {
  IMMUTABLE_CACHE_CONTROL,
  type PresignedUpload,
  type PutTarget,
  type Storage,
  type StoredObject,
} from './storage.js';

/** S3-compatible storage (MinIO now, R2/S3 later — configuration only). */
export class S3Storage implements Storage {
  private readonly internal: S3Client;
  private readonly signer: S3Client;

  constructor(
    private readonly bucket: string,
    config: {
      endpoint: string;
      publicEndpoint: string;
      region: string;
      key: string;
      secret: string;
    },
  ) {
    const base: S3ClientConfig = {
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.key, secretAccessKey: config.secret },
      // Only the checksum we choose (SHA-256) goes into signatures; no SDK default CRC32.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };
    this.internal = new S3Client({ ...base, endpoint: config.endpoint });
    this.signer = new S3Client({ ...base, endpoint: config.publicEndpoint });
  }

  async presignPut(t: PutTarget, expiresIn: number): Promise<PresignedUpload> {
    const headers: Record<string, string> = {
      'content-type': t.contentType,
      'cache-control': IMMUTABLE_CACHE_CONTROL,
      'x-amz-checksum-sha256': t.sha256,
      ...(t.contentEncoding ? { 'content-encoding': t.contentEncoding } : {}),
    };
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: t.key,
      ContentType: t.contentType,
      ContentLength: t.contentLength,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      ChecksumSHA256: t.sha256,
      ...(t.contentEncoding ? { ContentEncoding: t.contentEncoding } : {}),
    });
    const url = await getSignedUrl(this.signer, command, {
      expiresIn,
      // Bind size, type, and hash to the URL: the upload must be exactly the declared file.
      signableHeaders: new Set([...Object.keys(headers), 'content-length']),
    });
    return { url, method: 'PUT', headers };
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const res = await this.internal.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' }),
      );
      return { size: res.ContentLength ?? 0, sha256: res.ChecksumSHA256 ?? null };
    } catch (err) {
      if (err instanceof NotFound || (err as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw err;
    }
  }
}

/** Used when S3_* is not configured: the catalog works, publishing answers 503. */
export class UnconfiguredStorage implements Storage {
  presignPut(): Promise<PresignedUpload> {
    return Promise.reject(new ServiceUnavailableException('Storage is not configured'));
  }

  head(): Promise<StoredObject | null> {
    return Promise.reject(new ServiceUnavailableException('Storage is not configured'));
  }
}

export function storageFromEnv(env: Env): Storage {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    return new UnconfiguredStorage();
  }
  return new S3Storage(env.S3_BUCKET, {
    endpoint: env.S3_ENDPOINT,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
    region: env.S3_REGION,
    key: env.S3_ACCESS_KEY_ID,
    secret: env.S3_SECRET_ACCESS_KEY,
  });
}
