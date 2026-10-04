import { sql } from 'drizzle-orm';
import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Upload lifecycle of one immutable game version (`games/<id>/<version>/`). */
export const gameVersionStatus = pgEnum('game_version_status', [
  'pending',
  'uploaded',
  'approved',
  'rejected',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
};

export const games = pgTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** Version players get. Moving this pointer is how releases and rollbacks happen. */
  stableVersion: text('stable_version'),
  /** Latest uploaded version, reachable by admins for review. */
  previewVersion: text('preview_version'),
  /** Bundle size limit when an admin approved more than the default. */
  maxBundleBytes: bigint('max_bundle_bytes', { mode: 'number' }),
  ...timestamps,
});

/** One file of an uploaded bundle, as declared at publish time and verified on completion. */
export interface BundleFile {
  path: string;
  size: number;
  /** Base64 SHA-256, as S3 `x-amz-checksum-sha256`. */
  sha256: string;
  contentType: string;
  contentEncoding?: string;
}

export const gameVersions = pgTable(
  'game_versions',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    status: gameVersionStatus('status').notNull().default('pending'),
    manifest: jsonb('manifest').$type<Record<string, unknown>>().notNull(),
    /** SDK major the bundle was built with (from `game.json` `sdk`). */
    sdkMajor: integer('sdk_major').notNull().default(1),
    files: jsonb('files').$type<BundleFile[]>(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.gameId, t.version] })],
);

export const userRole = pgEnum('user_role', ['user', 'admin']);

/**
 * Platform account, keyed by the IdP subject. Games only ever see `id`, `nickname`, `avatar`
 * (design invariant 4) — never `sub`.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  sub: text('sub').notNull().unique(),
  nickname: text('nickname').notNull(),
  avatar: text('avatar'),
  role: userRole('role').notNull().default('user'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  ...timestamps,
});

/** Per-game publish credential. Only the SHA-256 of the key is stored. */
export const deployKeys = pgTable('deploy_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: text('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  /** Leading characters of the key, to tell keys apart in listings. */
  prefix: text('prefix').notNull(),
  label: text('label').notNull().default(''),
  createdAt: timestamps.createdAt,
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

/** SDK major lifecycle (docs/ARCHITECTURE.md §3). Data, not code: policy changes are row edits. */
export const sdkStatus = pgEnum('sdk_status', [
  'current',
  'lts',
  'maintenance',
  'deprecated',
  'eol',
]);

export const sdkVersions = pgTable('sdk_versions', {
  major: integer('major').primaryKey(),
  status: sdkStatus('status').notNull().default('current'),
  /** Host adapter bundle for this major, loaded by the shell at runtime. */
  adapterUrl: text('adapter_url'),
  /** Subresource integrity of the adapter bundle (`sha384-…`). */
  sri: text('sri'),
  deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
  eolAt: timestamp('eol_at', { withTimezone: true }),
  ...timestamps,
});

export const schema = {
  games,
  gameVersions,
  gameVersionStatus,
  sdkVersions,
  sdkStatus,
  deployKeys,
  users,
  userRole,
};
