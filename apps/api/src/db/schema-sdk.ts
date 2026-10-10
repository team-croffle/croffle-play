/**
 * SDK administration tables, split from `schema.ts` (file size): every adapter bundle registered
 * for a major, and the audit trail of what admins (or the api at boot) changed about a major.
 */
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { sdkVersions, users } from './schema.js';

/** Where an adapter bundle came from: the api image at boot, `register-cli`, or a dev manifest URL. */
export const adapterSource = pgEnum('adapter_source', ['image', 'cli', 'dev', 'npm']);

/** Every adapter bundle registered for a major (the active one is `sdkVersions.adapterUrl`). */
export const sdkAdapterVersions = pgTable(
  'sdk_adapter_versions',
  {
    major: integer('major')
      .notNull()
      .references(() => sdkVersions.major, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    url: text('url').notNull(),
    sri: text('sri').notNull(),
    source: adapterSource('source').notNull(),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.major, t.version] })],
);

/** What an admin (or the api at boot, `actor` null) changed about a major, for the audit trail. */
export const sdkAdminEventKind = pgEnum('sdk_admin_event_kind', [
  'adapter_activated',
  'status_changed',
  'schedule_changed',
]);

export const sdkAdminEvents = pgTable('sdk_admin_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  major: integer('major')
    .notNull()
    .references(() => sdkVersions.major, { onDelete: 'cascade' }),
  kind: sdkAdminEventKind('kind').notNull(),
  from: jsonb('from').$type<Record<string, unknown>>(),
  to: jsonb('to').$type<Record<string, unknown>>().notNull(),
  actor: uuid('actor').references(() => users.id, { onDelete: 'set null' }),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
