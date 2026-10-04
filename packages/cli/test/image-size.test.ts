import { describe, expect, it } from 'vitest';

import { imageInfo } from '../src/image-size.js';
import { validateBundle } from '../src/validate.js';
import { makeBundle, pngHeader } from './fixture.js';

function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment to skip, then SOF0 with height/width.
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0,
    0,
    0,
  ]);
}

function webpVp8x(width: number, height: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set(new TextEncoder().encode('RIFF'), 0);
  b.set(new TextEncoder().encode('WEBPVP8X'), 8);
  const w = width - 1;
  const h = height - 1;
  b.set(
    [w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff],
    24,
  );
  return b;
}

describe('imageInfo', () => {
  it('reads PNG, JPEG, and WebP headers', () => {
    expect(imageInfo(pngHeader(640, 360))).toEqual({ format: 'png', width: 640, height: 360 });
    expect(imageInfo(jpeg(800, 450))).toEqual({ format: 'jpeg', width: 800, height: 450 });
    expect(imageInfo(webpVp8x(1280, 720))).toEqual({ format: 'webp', width: 1280, height: 720 });
  });

  it('rejects anything else', () => {
    expect(imageInfo(new TextEncoder().encode('GIF89a......'))).toBeNull();
    expect(imageInfo(new Uint8Array([0xff, 0xd8, 0x00]))).toBeNull();
  });
});

describe('thumbnail rules', () => {
  it('refuses small, oversized, and non-image thumbnails', async () => {
    const small = await validateBundle(await makeBundle({ 'thumb.png': pngHeader(100, 100) }));
    expect(small.errors).toEqual(['thumbnail thumb.png is 100×100; at least 256×144 is required']);
    const big = await validateBundle(
      await makeBundle({
        'thumb.png': Buffer.concat([pngHeader(320, 180), Buffer.alloc(600 * 1024)]),
      }),
    );
    expect(big.errors[0]).toMatch(/limit is 512 KB/);
    const text = await validateBundle(await makeBundle({ 'thumb.png': 'not an image' }));
    expect(text.errors).toEqual(['thumbnail thumb.png is not a PNG, JPEG, or WebP image']);
  });
});
