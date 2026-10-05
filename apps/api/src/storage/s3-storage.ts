import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';

import type { Env } from '../config/env.js';
import type { Storage, StoredFile } from './storage.js';

/** Any S3-compatible store (MinIO/AIStor, R2, S3) — configuration only. */
export class S3Storage implements Storage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    config: { endpoint: string; region: string; key: string; secret: string },
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: config.key, secretAccessKey: config.secret },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async put(key: string, file: StoredFile & { cacheControl?: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.body,
        ContentType: file.contentType,
        ...(file.cacheControl ? { CacheControl: file.cacheControl } : {}),
      }),
    );
  }

  async get(key: string): Promise<StoredFile | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = await res.Body?.transformToByteArray();
      return body ? { body, contentType: res.ContentType ?? 'application/octet-stream' } : null;
    } catch (err) {
      if (err instanceof NoSuchKey || (err as { name?: string }).name === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  }
}

/** Used when S3_* is not configured: everything else works, stored files answer 503. */
export class UnconfiguredStorage implements Storage {
  put(): Promise<void> {
    return Promise.reject(new ServiceUnavailableException('Storage is not configured'));
  }

  get(): Promise<StoredFile | null> {
    return Promise.reject(new ServiceUnavailableException('Storage is not configured'));
  }
}

export function storageFromEnv(env: Env): Storage {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    return new UnconfiguredStorage();
  }
  return new S3Storage(env.S3_BUCKET, {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    key: env.S3_ACCESS_KEY_ID,
    secret: env.S3_SECRET_ACCESS_KEY,
  });
}
