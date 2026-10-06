import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrationsFolder } from '../src/db/db.js';

/** Applies the migration files in order, stopping before `stopBefore` (its numeric prefix). */
async function applyUntil(db: PGlite, stopBefore: string): Promise<void> {
  const files = readdirSync(migrationsFolder)
    .filter((f) => f.endsWith('.sql'))
    .toSorted();
  for (const file of files) {
    if (file >= stopBefore) {
      return;
    }
    await runFile(db, file);
  }
}

async function runFile(db: PGlite, file: string): Promise<void> {
  const sql = readFileSync(join(migrationsFolder, file), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim()) {
      await db.exec(statement);
    }
  }
}

describe('migration 0010: SDK lifecycle current → lts → old → deprecated', () => {
  const db = new PGlite();

  beforeAll(async () => {
    await applyUntil(db, '0010');
    await db.exec(`
      INSERT INTO games (id, name) VALUES ('g', 'G');
      INSERT INTO sdk_versions (major, status, deprecated_at, eol_at) VALUES
        (1, 'current', NULL, NULL),
        (2, 'maintenance', NULL, '2030-01-01T00:00:00Z'),
        (3, 'deprecated', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'),
        (4, 'eol', '2025-01-01T00:00:00Z', '2025-06-01T00:00:00Z');
      INSERT INTO sdk_notifications (game_id, major, kind) VALUES ('g', 3, 'deprecated'), ('g', 4, 'eol');
      INSERT INTO sdk_version_events (major, from_status, to_status) VALUES (4, 'deprecated', 'eol');
    `);
    await runFile(db, '0010_sdk_lifecycle.sql');
  });

  afterAll(async () => {
    await db.close();
  });

  it('maps statuses and moves the dates', async () => {
    const { rows } = await db.query<{
      major: number;
      status: string;
      old_at: Date | null;
      deprecated_at: Date | null;
    }>('SELECT major, status, old_at, deprecated_at FROM sdk_versions ORDER BY major');
    expect(rows.map((r) => [r.major, r.status])).toEqual([
      [1, 'current'],
      [2, 'lts'],
      [3, 'old'],
      [4, 'deprecated'],
    ]);
    expect(rows[2]?.old_at?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(rows[2]?.deprecated_at?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('maps notification kinds and recorded transitions', async () => {
    const kinds = await db.query<{ kind: string }>(
      'SELECT kind FROM sdk_notifications ORDER BY major',
    );
    expect(kinds.rows.map((r) => r.kind)).toEqual(['old', 'deprecated']);
    const events = await db.query<{ from_status: string; to_status: string }>(
      'SELECT from_status, to_status FROM sdk_version_events',
    );
    expect(events.rows).toEqual([{ from_status: 'old', to_status: 'deprecated' }]);
  });

  it('keeps the default for new majors', async () => {
    await db.exec('INSERT INTO sdk_versions (major) VALUES (9)');
    const { rows } = await db.query<{ status: string }>(
      'SELECT status FROM sdk_versions WHERE major = 9',
    );
    expect(rows[0]?.status).toBe('current');
  });
});

describe('migration 0011: deploy keys removed, server keys kept', () => {
  const db = new PGlite();

  beforeAll(async () => {
    await applyUntil(db, '0011');
    await db.exec(`
      INSERT INTO games (id, name) VALUES ('g', 'G');
      INSERT INTO deploy_keys (game_id, kind, key_hash, prefix) VALUES
        ('g', 'deploy', 'h1', 'cpk_g_aaaa'),
        ('g', 'server', 'h2', 'csk_g_bbbb');
    `);
    await runFile(db, '0011_server_keys.sql');
  });

  afterAll(async () => {
    await db.close();
  });

  it('keeps only server keys, in server_keys', async () => {
    const { rows } = await db.query<{ prefix: string }>('SELECT prefix FROM server_keys');
    expect(rows).toEqual([{ prefix: 'csk_g_bbbb' }]);
    const old = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_type WHERE typname = 'key_kind'",
    );
    expect(old.rows[0]?.n).toBe(0);
  });
});

describe('migration 0012: game registry instead of uploaded versions', () => {
  const db = new PGlite();

  beforeAll(async () => {
    await applyUntil(db, '0012');
    await db.exec(`
      INSERT INTO games (id, name, stable_version, preview_version) VALUES
        ('live', 'Live', '1.0.0', '1.1.0'),
        ('draft', 'Draft', NULL, '0.1.0');
      INSERT INTO game_versions (game_id, version, status, manifest, sdk_major) VALUES
        ('live', '1.0.0', 'approved', '{"id":"live","sdk":"^1.0.0"}', 1),
        ('live', '1.1.0', 'uploaded', '{"id":"live","sdk":"^2.0.0"}', 2),
        ('draft', '0.1.0', 'uploaded', '{"id":"draft","sdk":"^1.0.0"}', 1);
    `);
    await runFile(db, '0012_game_registry.sql');
  });

  afterAll(async () => {
    await db.close();
  });

  it('lists games that had a stable version, with that version manifest', async () => {
    const { rows } = await db.query<{
      id: string;
      listed: boolean;
      sdk_major: number | null;
      manifest: { sdk: string } | null;
    }>('SELECT id, listed, sdk_major, manifest FROM games ORDER BY id');
    expect(rows).toEqual([
      { id: 'draft', listed: false, sdk_major: null, manifest: null },
      { id: 'live', listed: true, sdk_major: 1, manifest: { id: 'live', sdk: '^1.0.0' } },
    ]);
    const tables = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'game_versions'",
    );
    expect(tables.rows[0]?.n).toBe(0);
  });
});

describe('migration 0017: the active adapter becomes the first recorded version', () => {
  const db = new PGlite();

  beforeAll(async () => {
    await applyUntil(db, '0017');
    await db.exec(`
      INSERT INTO sdk_versions (major, status, adapter_url, sri) VALUES
        (1, 'current', '/adapters/v1/0.12.0/index.js', 'sha384-aaa'),
        (2, 'current', 'http://localhost:4100/adapters/v2/dev/index.js', 'sha384-bbb'),
        (3, 'current', NULL, NULL);
    `);
    await runFile(db, '0017_sdk_adapter_versions.sql');
  });

  afterAll(async () => {
    await db.close();
  });

  it('backfills release bundles as cli versions and anything else as dev', async () => {
    const { rows } = await db.query<{ major: number; version: string; source: string }>(
      'SELECT major, version, source FROM sdk_adapter_versions ORDER BY major',
    );
    expect(rows).toEqual([
      { major: 1, version: '0.12.0', source: 'cli' },
      { major: 2, version: 'dev', source: 'dev' },
    ]);
  });
});
