import { sql } from 'drizzle-orm';
import { integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

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
  ...timestamps,
});

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
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.gameId, t.version] })],
);

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

export const schema = { games, gameVersions, gameVersionStatus, sdkVersions, sdkStatus };
