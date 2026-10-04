import { sql } from 'drizzle-orm';
import { jsonb, pgEnum, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

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
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.gameId, t.version] })],
);

export const schema = { games, gameVersions, gameVersionStatus };
