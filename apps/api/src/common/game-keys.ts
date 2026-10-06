import { randomToken, sha256Hex } from './secret.js';

/**
 * Per-game credentials (`<prefix>_<game>_<random>`): server keys (`csk`) for verified scores,
 * deploy keys (`cdk`) for uploading builds. Only the SHA-256 is stored; the raw key is shown
 * once, at issue. These helpers are the parts that do not depend on which table holds the key.
 */
export interface GameKeyRow {
  id: string;
  gameId: string;
  keyHash: string;
  prefix: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface GameKeyView {
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

/** A fresh key and what is stored of it. */
export function newGameKey(
  kind: string,
  gameId: string,
  label: string,
): { key: string; row: { keyHash: string; prefix: string; label: string } } {
  const key = `${kind}_${gameId}_${randomToken()}`;
  return {
    key,
    row: { keyHash: sha256Hex(key), prefix: key.slice(0, gameId.length + 11), label },
  };
}

export function hasKind(raw: string, kind: string): boolean {
  return raw.startsWith(`${kind}_`);
}

/** Usable now: neither revoked nor expired. */
export function isActiveKey(row: GameKeyRow, now = Date.now()): boolean {
  return !row.revokedAt && !(row.expiresAt && row.expiresAt.getTime() <= now);
}

/** When a rotated key's predecessor stops working. */
export function graceUntil(graceHours: number, now = Date.now()): Date {
  return new Date(now + graceHours * 3_600_000);
}

export function toKeyView(row: GameKeyRow): GameKeyView {
  return {
    id: row.id,
    prefix: row.prefix,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}
