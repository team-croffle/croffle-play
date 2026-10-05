import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { stripJpegExif } from '../src/users/avatar.js';
import { FakeStorage } from './support/fake-storage.js';
import { createTestApp, type TestApp } from './support/test-app.js';
import { bearerFor } from './support/test-issuer.js';

function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

describe('avatars', () => {
  let t: TestApp;
  const storage = new FakeStorage();
  let auth: { authorization: string };

  beforeAll(async () => {
    t = await createTestApp({ storage });
    auth = await bearerFor('idp|ava');
  });

  afterAll(async () => {
    await t.close();
  });

  const put = (body: Buffer, type = 'image/png') =>
    t.app.inject({
      method: 'PUT',
      url: '/v1/me/avatar',
      headers: { ...auth, 'content-type': type },
      payload: body,
    });

  it('stores an image by content hash and serves it immutably', async () => {
    const res = await put(png(128, 128));
    expect(res.statusCode).toBe(200);
    const avatar = res.json<{ avatar: string }>().avatar;
    expect(avatar).toMatch(/^\/avatars\/[0-9a-f-]{36}\/[0-9a-f]{32}\.png$/);
    const file = await t.app.inject({ method: 'GET', url: `/v1${avatar}` });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['cache-control']).toContain('immutable');
  });

  it('refuses non-images, tiny images, and unauthenticated uploads', async () => {
    expect((await put(Buffer.from('not an image'))).statusCode).toBe(422);
    expect((await put(png(16, 16))).statusCode).toBe(422);
    const anon = await t.app.inject({
      method: 'PUT',
      url: '/v1/me/avatar',
      headers: { 'content-type': 'image/png' },
      payload: png(128, 128),
    });
    expect(anon.statusCode).toBe(401);
  });

  it('keeps an uploaded avatar when sign-in syncs the IdP picture', async () => {
    const synced = await t.app.inject({
      method: 'PUT',
      url: '/v1/me',
      headers: auth,
      payload: { nickname: 'Ava', avatar: 'https://idp.test/pic.png' },
    });
    expect(synced.json()).toMatchObject({
      nickname: 'Ava',
      avatar: expect.stringMatching(/^\/avatars\//),
    });
    const removed = await t.app.inject({ method: 'DELETE', url: '/v1/me/avatar', headers: auth });
    expect(removed.json()).toMatchObject({ avatar: null });
  });

  it('404s malformed avatar paths', async () => {
    expect((await t.app.inject({ method: 'GET', url: '/v1/avatars/x/y.png' })).statusCode).toBe(
      404,
    );
  });
});

describe('stripJpegExif', () => {
  it('drops APP1 segments and keeps the rest', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x04, 0x45, 0x78, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff,
      0xda, 0x01, 0x02,
    ]);
    expect([...stripJpegExif(jpeg)]).toEqual([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xda, 0x01, 0x02,
    ]);
  });
});
