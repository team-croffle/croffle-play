import { createHash } from 'node:crypto';

import type {
  PresignedUpload,
  PutTarget,
  Storage,
  StoredObject,
} from '../../src/storage/storage.js';

/** In-memory storage: records presigns; `upload()` simulates a client PUT. */
export class FakeStorage implements Storage {
  readonly presigned: PutTarget[] = [];
  readonly objects = new Map<string, StoredObject>();

  async presignPut(t: PutTarget, expiresIn: number): Promise<PresignedUpload> {
    this.presigned.push(t);
    return {
      url: `https://s3.test/games/${t.key}?X-Amz-Expires=${expiresIn}`,
      method: 'PUT',
      headers: { 'content-type': t.contentType, 'x-amz-checksum-sha256': t.sha256 },
    };
  }

  async head(key: string): Promise<StoredObject | null> {
    return this.objects.get(key) ?? null;
  }

  upload(key: string, body: string): void {
    this.objects.set(key, { size: Buffer.byteLength(body), sha256: sha256b64(body) });
  }
}

export function sha256b64(body: string): string {
  return createHash('sha256').update(body).digest('base64');
}
