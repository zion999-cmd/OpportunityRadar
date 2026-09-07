// apps/recruiting-exhibit/db.ts — opens the exhibit's SQLite file
// and applies the exhibit DDL + defensive migrations.
//
// Per task.md: "用最小实现。SQLite 即可。" — we co-locate the
// exhibit with the existing dev.db at `data/dev.db` so a single
// process can host both the Radar core tables and the exhibit
// tables. The exhibit only ever reads from / writes to its own
// `exhibit_*` tables; the rest of the schema is left alone.
//
// Migration policy for old exhibit databases
// -----------------------------------------
// The pre-audit-fix exhibit stored the FEED URL in
// `source_url` and had no `feed_url` column, no unique
// constraint, and no dedup. Repeated runs over the same
// feed inserted the same (source_label, source_url) pair
// many times. Opening such a database with the current
// code is supported by the following policy, which is the
// smallest safe change that satisfies the new dedup
// invariant without redesigning storage:
//
//   1. Add the `feed_url` column to `exhibit_source_items`
//      (idempotent — duplicate-column errors are swallowed).
//   2. For every (source_label, source_url) group that
//      already has more than one row, collapse it to a
//      single row, keeping the row with the EARLIEST
//      `captured_at`. The other source_item rows in the
//      group are about to be deleted, so any evidence rows
//      that point at them are first re-pointed at the
//      keeper source_item. This is the only safe way to
//      keep the dependent data: the foreign key on
//      `exhibit_reconstructed_evidence.source_item_id` is
//      declared `ON DELETE CASCADE`, so deleting a
//      source_item without re-attaching its evidence would
//      destroy the (otherwise valid) evidence/relationship
//      content.
//   3. Once duplicates are collapsed, create the unique
//      index on (source_label, source_url). This is the
//      dedup invariant the new orchestrator relies on. The
//      step is idempotent: subsequent opens of an already-
//      migrated database are no-ops.
//
// The old source_url values are NOT migrated to feed_url.
// They are the pre-fix feed URLs, not article URLs, and
// the new orchestrator reads feed_url from the
// `FIXED_SOURCES` table, not from the row. Old rows simply
// remain as historical evidence that those (label, feed)
// pairs were once observed.

import { openDatabase, type SqliteDatabase } from '../../storage/connection.js';
import { EXHIBIT_DDL } from './schema.js';

export const DEFAULT_EXHIBIT_DB_PATH = 'data/dev.db';

export function openExhibitDatabase(path: string = DEFAULT_EXHIBIT_DB_PATH): SqliteDatabase {
  const db = openDatabase(path);
  applyExhibitDdl(db);
  applyDefensiveMigrations(db);
  return db;
}

function applyExhibitDdl(db: SqliteDatabase): void {
  for (const stmt of EXHIBIT_DDL) {
    db.exec(stmt);
  }
}

// Defensive in-place migrations for DBs created by an earlier
// version of the exhibit.
//
// 1. Add the `feed_url` column. SQLite has no
//    `ADD COLUMN IF NOT EXISTS`; we attempt the ALTER and
//    swallow the "duplicate column" error, which is the
//    documented SQLite signal that the column already
//    exists.
// 2. Collapse pre-existing (source_label, source_url)
//    duplicates so the unique dedup invariant can be
//    created. See the file header for the full policy.
// 3. Create the unique dedup index. Safe to run because
//    step 2 already removed the duplicates.
function applyDefensiveMigrations(db: SqliteDatabase): void {
  for (const stmt of DEFENSIVE_MIGRATIONS) {
    try {
      db.exec(stmt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate column name/i.test(message)) {
        throw err;
      }
    }
  }
  applyOldSourceItemDedupPolicy(db);
  for (const stmt of DEFENSIVE_INDEXES) {
    try {
      db.exec(stmt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/already exists/i.test(message)) {
        throw err;
      }
    }
  }
}

const DEFENSIVE_MIGRATIONS: readonly string[] = [
  `ALTER TABLE exhibit_source_items ADD COLUMN feed_url TEXT NOT NULL DEFAULT ''`,
];

const DEFENSIVE_INDEXES: readonly string[] = [
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_exhibit_source_dedup ON exhibit_source_items(source_label, source_url)`,
];

// Find every (source_label, source_url) group with more
// than one row and collapse each to the row with the
// earliest captured_at. Re-attach evidence rows first so
// the ON DELETE CASCADE on the source_item foreign key
// does not destroy otherwise-valid evidence/relationship
// content.
function applyOldSourceItemDedupPolicy(db: SqliteDatabase): void {
  const dupGroups = db
    .prepare(
      `SELECT source_label, source_url
       FROM exhibit_source_items
       GROUP BY source_label, source_url
       HAVING COUNT(*) > 1`,
    )
    .all() as Array<{ source_label: string; source_url: string }>;
  if (dupGroups.length === 0) return;

  const lookupGroup = db.prepare(
    `SELECT id, captured_at FROM exhibit_source_items
     WHERE source_label = ? AND source_url = ?
     ORDER BY captured_at ASC`,
  );
  const reattachEvidence = db.prepare(
    `UPDATE exhibit_reconstructed_evidence
     SET source_item_id = ?
     WHERE source_item_id = ?`,
  );
  const deleteSourceItem = db.prepare(`DELETE FROM exhibit_source_items WHERE id = ?`);

  for (const group of dupGroups) {
    const rows = lookupGroup.all(group.source_label, group.source_url) as Array<{
      id: string;
      captured_at: string;
    }>;
    if (rows.length <= 1) continue;
    const keeper = rows[0];
    if (keeper === undefined) continue;
    const duplicates = rows.slice(1);
    for (const dup of duplicates) {
      reattachEvidence.run(keeper.id, dup.id);
      deleteSourceItem.run(dup.id);
    }
  }
}
