import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
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

/**
 * Whose scores count: `client` (Tier 1, reported by the game in the browser — shown as
 * unverified) or `server` (only scores submitted by the game's own server with its server key).
 */
export const scorePolicy = pgEnum('score_policy', ['client', 'server']);

export const games = pgTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** Version players get. Moving this pointer is how releases and rollbacks happen. */
  stableVersion: text('stable_version'),
  /** Latest uploaded version, reachable by admins for review. */
  previewVersion: text('preview_version'),
  scorePolicy: scorePolicy('score_policy').notNull().default('client'),
  /** Scores outside [min, max] are refused (sanity bounds; null = unbounded). */
  scoreMin: doublePrecision('score_min'),
  scoreMax: doublePrecision('score_max'),
  /** GitHub repository (`owner/name`) for platform notices. Set by admins only. */
  repo: text('repo'),
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

/** Every submitted score; the leaderboard is each player's best. */
export const scores = pgTable(
  'scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    score: doublePrecision('score').notNull(),
    /** Submitted by the game's server (server key), not by the browser. */
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('scores_game_user_score_idx').on(t.gameId, t.userId, t.score)],
);

/** Game save slots per player (Tier 1: the shell stores them on the player's behalf). */
export const saves = pgTable(
  'saves',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    data: text('data').notNull(),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [primaryKey({ columns: [t.gameId, t.userId, t.slot] })],
);

export const gameServerStatus = pgEnum('game_server_status', ['requested', 'approved', 'revoked']);

/**
 * Tier 2: a game's own server container (design invariant 7). Approval is per image; publishing a
 * different image or protocol asks for approval again.
 */
export const gameServers = pgTable('game_servers', {
  gameId: text('game_id')
    .primaryKey()
    .references(() => games.id, { onDelete: 'cascade' }),
  image: text('image').notNull(),
  protocol: text('protocol').notNull(),
  status: gameServerStatus('status').notNull().default('requested'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamps.updatedAt,
});

export const memberRole = pgEnum('member_role', ['owner', 'developer']);

/** Team members of a game: they see it on their developer dashboard. Granted by admins. */
export const gameMembers = pgTable(
  'game_members',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull().default('developer'),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.gameId, t.userId] })],
);

/**
 * Per-game credential of the game's own server (`csk_…`): it submits verified scores. Only the
 * SHA-256 of the key is stored.
 */
export const serverKeys = pgTable('server_keys', {
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

/**
 * SDK major lifecycle (docs/sdk-lifecycle.md). Data, not code: policy changes are row edits.
 * `old`: no new games or updates on it; `deprecated`: games on it no longer run.
 */
export const sdkStatus = pgEnum('sdk_status', ['current', 'lts', 'old', 'deprecated']);

export const sdkVersions = pgTable('sdk_versions', {
  major: integer('major').primaryKey(),
  status: sdkStatus('status').notNull().default('current'),
  /** Host adapter bundle for this major, loaded by the shell at runtime. */
  adapterUrl: text('adapter_url'),
  /** Subresource integrity of the adapter bundle (`sha384-…`). */
  sri: text('sri'),
  /** From this time the major is `old` (unless already deprecated). */
  oldAt: timestamp('old_at', { withTimezone: true }),
  /** From this time the major is `deprecated`: games on it stop running. */
  deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
  ...timestamps,
});

/** One notice per (game, SDK major, status) — the sync job may run any number of times. */
export const sdkNotifications = pgTable(
  'sdk_notifications',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    major: integer('major').notNull(),
    kind: sdkStatus('kind').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.gameId, t.major, t.kind] })],
);

/** Lifecycle transitions applied by the sync job (audit trail and notification source). */
export const sdkVersionEvents = pgTable('sdk_version_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  major: integer('major')
    .notNull()
    .references(() => sdkVersions.major, { onDelete: 'cascade' }),
  fromStatus: sdkStatus('from_status').notNull(),
  toStatus: sdkStatus('to_status').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  games,
  gameVersions,
  gameVersionStatus,
  sdkVersions,
  sdkStatus,
  serverKeys,
  users,
  userRole,
  scores,
  saves,
  gameServers,
  gameServerStatus,
  sdkVersionEvents,
  sdkNotifications,
  gameMembers,
  memberRole,
  scorePolicy,
};
