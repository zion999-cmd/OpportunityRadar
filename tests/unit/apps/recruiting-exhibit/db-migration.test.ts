// Migration test for old exhibit databases.
//
// Before the Live Observation Integrity Fix, the exhibit
// schema was:
//
//   CREATE TABLE exhibit_source_items (
//     id, run_id, source_label, source_url, captured_at,
//     title, raw_excerpt, fetch_status, fetch_error
//   )
//
// with no `feed_url` column, no `dedup_key` column, and no
// UNIQUE index on (source_label, source_url). Worse, the
// pre-fix code stored the FEED URL in `source_url` (because
// that was the only URL column available), so repeated runs
// over the same feed inserted the same (source_label,
// source_url) pair many times.
//
// The current `openExhibitDatabase()` must be able to open
// such a database without error and end with the unique
// dedup invariant in place. The migration policy is
// documented in `apps/recruiting-exhibit/db.ts`. The
// post-migration unique index is on
// (source_label, dedup_key). For pre-migration rows,
// `dedup_key` is backfilled from `source_url` (the only
// URL available), so a freshly-migrated old DB is
// effectively unique on the same (label, source_url) pair
// the old orchestrator was using.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../../../../storage/connection.js';
import { openExhibitDatabase } from '../../../../apps/recruiting-exhibit/db.js';

let workDir = '';
let dbPath = '';

beforeEach(() => {
  workDir = mkdtempSync(resolve(tmpdir(), 'recruiting-exhibit-migration-'));
  dbPath = resolve(workDir, 'exhibit.db');
});

afterEach(() => {
  if (workDir.length > 0) rmSync(workDir, { recursive: true, force: true });
});

describe('exhibit db migration from old shape', () => {
  it('opens an old DB with duplicate (source_label, source_url) rows and establishes the unique dedup invariant', () => {
    // 1. Create the OLD-shape DB directly. No `feed_url`
    //    column. No UNIQUE index. No dedup invariant.
    const oldDb = openDatabase(dbPath);
    oldDb.exec(`
      CREATE TABLE exhibit_source_items (
        id            TEXT PRIMARY KEY,
        run_id        TEXT NOT NULL,
        source_label  TEXT NOT NULL,
        source_url    TEXT NOT NULL,
        captured_at   TEXT NOT NULL,
        title         TEXT,
        raw_excerpt   TEXT NOT NULL,
        fetch_status  TEXT NOT NULL,
        fetch_error   TEXT
      );
      CREATE INDEX idx_exhibit_sources_run_id_old ON exhibit_source_items(run_id);
    `);

    // 2. Insert old-style rows. The pre-fix code stored
    //    the FEED URL in `source_url` and had no
    //    uniqueness, so the same (label, feed-url) pair
    //    can appear many times. Three duplicates for
    //    github-engineering, two for cloudflare-engineering.
    const insertOld = oldDb.prepare(
      `INSERT INTO exhibit_source_items (id, run_id, source_label, source_url, captured_at, title, raw_excerpt, fetch_status, fetch_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', NULL)`,
    );
    insertOld.run('g1', 'r1', 'github-engineering', 'https://github.blog/engineering/feed/', '2026-09-01T00:00:00Z', 'a', 'a-excerpt');
    insertOld.run('g2', 'r1', 'github-engineering', 'https://github.blog/engineering/feed/', '2026-09-02T00:00:00Z', 'a', 'a-excerpt');
    insertOld.run('g3', 'r1', 'github-engineering', 'https://github.blog/engineering/feed/', '2026-09-03T00:00:00Z', 'a', 'a-excerpt');
    insertOld.run('c1', 'r1', 'cloudflare-engineering', 'https://blog.cloudflare.com/tag/engineering/rss', '2026-09-01T00:00:00Z', 'b', 'b-excerpt');
    insertOld.run('c2', 'r1', 'cloudflare-engineering', 'https://blog.cloudflare.com/tag/engineering/rss', '2026-09-02T00:00:00Z', 'b', 'b-excerpt');
    oldDb.close();

    // 3. Open through the current openExhibitDatabase().
    //    This must succeed even though the old DB has
    //    duplicate (source_label, source_url) rows.
    const migratedDb = openExhibitDatabase(dbPath);
    try {
      // 4. Verify the unique dedup invariant: a new attempt
      //    to insert the same (label, dedup_key) pair must
      //    now fail with a UNIQUE constraint violation. The
      //    pre-fix rows had their `dedup_key` backfilled
      //    from `source_url` (the only URL available), so
      //    re-using the old source_url as the new dedup_key
      //    exercises the backfill policy.
      const insertAgain = migratedDb.prepare(
        `INSERT INTO exhibit_source_items (id, run_id, source_label, source_url, feed_url, dedup_key, captured_at, title, raw_excerpt, fetch_status, fetch_error)
         VALUES ('new', 'r2', 'github-engineering', 'https://github.blog/engineering/feed/', 'https://github.blog/engineering/feed/', 'https://github.blog/engineering/feed/', '2026-09-04T00:00:00Z', 'a', 'a-excerpt', 'ok', NULL)`,
      );
      expect(() => insertAgain.run()).toThrow();

      // 5. Verify the dedup policy collapsed to one row per
      //    (label, source_url) group. The keeper is the
      //    row with the earliest captured_at — for
      //    github-engineering that is g1, for
      //    cloudflare-engineering that is c1.
      const ghCount = (migratedDb
        .prepare(`SELECT COUNT(*) AS c FROM exhibit_source_items WHERE source_label = 'github-engineering'`)
        .get() as { c: number }).c;
      expect(ghCount).toBe(1);
      const cfCount = (migratedDb
        .prepare(`SELECT COUNT(*) AS c FROM exhibit_source_items WHERE source_label = 'cloudflare-engineering'`)
        .get() as { c: number }).c;
      expect(cfCount).toBe(1);

      // 6. Verify the keeper is the earliest row. For
      //    github-engineering, g1 (captured_at 09-01) must
      //    be the survivor; g2 and g3 must be gone.
      const survivors = migratedDb
        .prepare(`SELECT id, captured_at FROM exhibit_source_items ORDER BY source_label`)
        .all() as Array<{ id: string; captured_at: string }>;
      const github = survivors.find((r) => r.id.startsWith('g'));
      const cloudflare = survivors.find((r) => r.id.startsWith('c'));
      expect(github?.id).toBe('g1');
      expect(cloudflare?.id).toBe('c1');
    } finally {
      migratedDb.close();
    }
  });

  it('re-attaches evidence rows from duplicate source_items to the kept (earliest) one', () => {
    // The dedup policy must not destroy evidence data
    // that pointed at the duplicate source_items.
    // Foreign keys are ON DELETE CASCADE, so without
    // re-attaching the evidence rows first, deleting a
    // duplicate source_item would cascade-delete its
    // evidence (and any relationship row attached to that
    // evidence).
    const oldDb = openDatabase(dbPath);
    oldDb.exec(`
      CREATE TABLE exhibit_source_items (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL, source_label TEXT NOT NULL,
        source_url TEXT NOT NULL, captured_at TEXT NOT NULL, title TEXT,
        raw_excerpt TEXT NOT NULL, fetch_status TEXT NOT NULL, fetch_error TEXT
      );
      CREATE TABLE exhibit_reconstructed_evidence (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL, source_item_id TEXT NOT NULL,
        claim TEXT NOT NULL, implied_meaning TEXT NOT NULL,
        hypotheses_unknowns TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `);
    const insertItem = oldDb.prepare(
      `INSERT INTO exhibit_source_items (id, run_id, source_label, source_url, captured_at, title, raw_excerpt, fetch_status, fetch_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', NULL)`,
    );
    const insertEvidence = oldDb.prepare(
      `INSERT INTO exhibit_reconstructed_evidence (id, run_id, source_item_id, claim, implied_meaning, hypotheses_unknowns, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    // Two source_items with the same (label, url): s_early
    // (earlier captured_at, the keeper) and s_late.
    insertItem.run('s_early', 'r1', 'github-engineering', 'https://github.blog/engineering/feed/', '2026-09-01T00:00:00Z', 'a', 'a-excerpt');
    insertItem.run('s_late',  'r2', 'github-engineering', 'https://github.blog/engineering/feed/', '2026-09-02T00:00:00Z', 'a', 'a-excerpt');
    // Each old source_item has its own evidence row.
    insertEvidence.run('e_early', 'r1', 's_early', 'early claim', 'early meaning', 'early unknowns', '2026-09-01T00:01:00Z');
    insertEvidence.run('e_late',  'r2', 's_late',  'late claim',  'late meaning',  'late unknowns',  '2026-09-02T00:01:00Z');
    oldDb.close();

    const migratedDb = openExhibitDatabase(dbPath);
    try {
      // 1. The duplicate source_item is gone; the keeper
      //    is the earliest row.
      const items = migratedDb.prepare(`SELECT id FROM exhibit_source_items`).all() as Array<{ id: string }>;
      expect(items.length).toBe(1);
      expect(items[0]?.id).toBe('s_early');

      // 2. Both evidence rows survive (no cascade delete)
      //    AND they now point at the keeper source_item.
      const evidences = migratedDb
        .prepare(`SELECT id, source_item_id FROM exhibit_reconstructed_evidence ORDER BY id`)
        .all() as Array<{ id: string; source_item_id: string }>;
      expect(evidences.length).toBe(2);
      for (const e of evidences) {
        expect(e.source_item_id).toBe('s_early');
      }
    } finally {
      migratedDb.close();
    }
  });

  it('is idempotent: re-opening an already-migrated DB is a no-op', () => {
    // First open + close.
    const a = openExhibitDatabase(dbPath);
    a.close();
    // Second open + close must not throw.
    const b = openExhibitDatabase(dbPath);
    try {
      // Insert a parent run row so the source_item FK is
      // satisfied for the duplicate-rejection test.
      b.exec(`INSERT INTO exhibit_observation_runs (id, kind, started_at, status)
              VALUES ('r', 'manual', '2026-09-01T00:00:00Z', 'succeeded')`);
      // The unique index still rejects duplicates.
      const insert = b.prepare(
        `INSERT INTO exhibit_source_items (id, run_id, source_label, source_url, feed_url, captured_at, title, raw_excerpt, fetch_status, fetch_error)
         VALUES ('x', 'r', 'x', 'u', '', '2026-09-01T00:00:00Z', NULL, '', 'ok', NULL)`,
      );
      insert.run();
      expect(() => insert.run()).toThrow();
    } finally {
      b.close();
    }
  });
});
