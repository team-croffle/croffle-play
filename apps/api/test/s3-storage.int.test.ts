// Opt-in integration test against a real S3 API (MinIO):
//   S3_TEST_ENDPOINT=http://127.0.0.1:9000 S3_TEST_KEY=… S3_TEST_SECRET=… pnpm test
import { createHash } from 'node:crypto';

import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import { S3Storage } from '../src/storage/s3-storage.js';

const endpoint = process.env.S3_TEST_ENDPOINT;

describe.skipIf(!endpoint)('S3Storage on a real S3 API', () => {
  const cfg = {
    endpoint: endpoint ?? '',
    publicEndpoint: endpoint ?? '',
    region: 'us-east-1',
    key: process.env.S3_TEST_KEY ?? '',
    secret: process.env.S3_TEST_SECRET ?? '',
  };
  const bucket = `it-${Date.now()}`;
  const body = 'console.log("hello")';
  const target = {
    contentType: 'text/javascript',
    contentLength: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('base64'),
  };

  it('accepts exactly the declared file and nothing else', async () => {
    const admin = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.key, secretAccessKey: cfg.secret },
    });
    await admin.send(new CreateBucketCommand({ Bucket: bucket }));
    const storage = new S3Storage(bucket, cfg);

    const good = await storage.presignPut({ ...target, key: 'g/1.0.0/a.js' }, 60);
    const put = await fetch(good.url, { method: 'PUT', headers: good.headers, body });
    expect(put.status).toBe(200);
    expect(await storage.head('g/1.0.0/a.js')).toEqual({
      size: target.contentLength,
      sha256: target.sha256,
    });

    const other = await storage.presignPut({ ...target, key: 'g/1.0.0/b.js' }, 60);
    const sameLength = body.replace('hello', 'HELLO');
    expect(
      (await fetch(other.url, { method: 'PUT', headers: other.headers, body: sameLength })).ok,
    ).toBe(false);
    expect(
      (await fetch(other.url, { method: 'PUT', headers: other.headers, body: `${body}!` })).ok,
    ).toBe(false);
    expect(await storage.head('g/1.0.0/b.js')).toBeNull();
  });
});
