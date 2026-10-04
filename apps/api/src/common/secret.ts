import { createHash, randomBytes } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** `Authorization: Bearer <token>` → token, or null. */
export function bearer(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  const m = /^Bearer\s+(\S+)$/i.exec(value ?? '');
  return m?.[1] ?? null;
}
