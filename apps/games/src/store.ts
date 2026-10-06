import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';

import type { Config } from './config.js';

export interface StoredFile {
  body: Uint8Array;
  contentType: string;
  etag: string | null;
}

/** Read-only view of the api's bucket: the game host never writes. */
export interface ReadStore {
  get(key: string): Promise<StoredFile | null>;
}

export class S3ReadStore implements ReadStore {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    config: Pick<Config, 'S3_ENDPOINT' | 'S3_REGION' | 'S3_ACCESS_KEY_ID' | 'S3_SECRET_ACCESS_KEY'>,
  ) {
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async get(key: string): Promise<StoredFile | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = await res.Body?.transformToByteArray();
      return body
        ? {
            body,
            contentType: res.ContentType ?? 'application/octet-stream',
            etag: res.ETag ?? null,
          }
        : null;
    } catch (err) {
      if (err instanceof NoSuchKey || (err as { name?: string }).name === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  }
}

export function storeFromConfig(config: Config): ReadStore {
  return new S3ReadStore(config.S3_BUCKET, config);
}
