import { createHash } from 'node:crypto';

import { imageInfo } from '@croffledev/play-protocol';

export const AVATAR_MAX_BYTES = 512 * 1024;
const MIN_SIDE = 64;
const TYPES = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const;

export type AvatarCheck =
  | { ok: true; body: Uint8Array; contentType: string; ext: string; hash: string }
  | { ok: false; reason: string };

/**
 * Accepts PNG, JPEG, or WebP by its header (never by the declared type), at least 64×64 and at most
 * 512 KB. JPEG EXIF (APP1) segments are dropped so photos do not leak location data.
 */
export function checkAvatar(input: Uint8Array): AvatarCheck {
  if (input.length === 0 || input.length > AVATAR_MAX_BYTES) {
    return { ok: false, reason: `Avatar must be 1 B to ${AVATAR_MAX_BYTES / 1024} KB` };
  }
  const info = imageInfo(input);
  if (!info) {
    return { ok: false, reason: 'Avatar must be a PNG, JPEG, or WebP image' };
  }
  if (info.width < MIN_SIDE || info.height < MIN_SIDE) {
    return { ok: false, reason: `Avatar must be at least ${MIN_SIDE}×${MIN_SIDE}` };
  }
  const body = info.format === 'jpeg' ? stripJpegExif(input) : input;
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 32);
  return { ok: true, body, contentType: TYPES[info.format], ext: info.format, hash };
}

/** Removes APP1 (EXIF/XMP) segments before the image data. */
export function stripJpegExif(b: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1] ?? 0;
    if (marker === 0xda) {
      break; // start of scan: the rest is image data
    }
    const end = i + 2 + (((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0));
    if (marker !== 0xe1) {
      parts.push(b.subarray(i, end));
    }
    i = end;
  }
  parts.push(b.subarray(i));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
