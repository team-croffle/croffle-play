// Opt-in integration test against a real S3 API (MinIO/AIStor):
//   S3_TEST_ENDPOINT=http://127.0.0.1:9000 S3_TEST_KEY=… S3_TEST_SECRET=… pnpm test
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import { S3Storage } from '../src/storage/s3-storage.js';

const endpoint = process.env.S3_TEST_ENDPOINT;

describe.skipIf(!endpoint)('S3Storage on a real S3 API', () => {
  const cfg = {
    endpoint: endpoint ?? '',
    region: 'us-east-1',
    key: process.env.S3_TEST_KEY ?? '',
    secret: process.env.S3_TEST_SECRET ?? '',
  };
  const bucket = `it-${Date.now()}`;

  it('stores and reads back objects, and reports missing ones as null', async () => {
    const admin = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.key, secretAccessKey: cfg.secret },
    });
    await admin.send(new CreateBucketCommand({ Bucket: bucket }));
    const storage = new S3Storage(bucket, cfg);
    const body = new TextEncoder().encode('console.log("hello")');
    await storage.put('adapters/v1/1.0.0/index.js', { body, contentType: 'text/javascript' });
    const got = await storage.get('adapters/v1/1.0.0/index.js');
    expect(got?.contentType).toBe('text/javascript');
    expect(new TextDecoder().decode(got?.body)).toBe('console.log("hello")');
    expect(await storage.get('adapters/v1/9.9.9/index.js')).toBeNull();
  });
});
