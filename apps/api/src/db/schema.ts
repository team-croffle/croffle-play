import type { GameManifest } from '@croffledev/play-protocol';
import { sql } from 'drizzle-orm';
import {
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
  /** Shown in the catalog. Only admins can play unlisted games. */
  listed: boolean('listed').notNull().default(false),
  /**
   * The game's `game.json`, as last fetched from `<game origin>/game.json` (the game is hosted by
   * its team, not by the platform). Null until the first successful refresh.
   */
  manifest: jsonb('manifest').$type<GameManifest>(),
  /** SDK major of `manifest.sdk`; the SDK lifecycle gates listing and refreshes on it. */
  sdkMajor: integer('sdk_major'),
  manifestFetchedAt: timestamp('manifest_fetched_at', { withTimezone: true }),
  /** Why the last refresh failed (null after a successful one). */
  manifestError: text('manifest_error'),
  scorePolicy: scorePolicy('score_policy').notNull().default('client'),
  /** Scores outside [min, max] are refused (sanity bounds; null = unbounded). */
  scoreMin: doublePrecision('score_min'),
  scoreMax: doublePrecision('score_max'),
  /** GitHub repository (`owner/name`) for platform notices. Set by admins only. */
  repo: text('repo'),
  ...timestamps,
});

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
  /** The player uploaded their avatar: sign-in no longer replaces it with the IdP picture. */
  avatarUploaded: boolean('avatar_uploaded').notNull().default(false),
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
