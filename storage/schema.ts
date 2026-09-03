// Schema DDL for Opportunity Radar.
//
// P0001 (V1) introduced the Evidence layer:
// - source_documents — unique on canonical_url (normalized form)
// - evidence         — unique on fingerprint
// - evidence_sources — many-to-many join
// - schema_version   — minimum-viable version tracking; not a
//                      migration framework
//
// P0002 (V2) adds the exploration run record:
// - exploration_runs — one row per Exploration Goal the bridge
//                      executes; binds a Goal, the timing, the
//                      outcome status, and the candidate /
//                      accepted / rejected counts.
//
// All DDL is idempotent (`IF NOT EXISTS`) so `initSchema` can be
// called against a fresh DB or an already-initialized DB without
// erroring. Migrations are applied in version order.

export const V1_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS source_documents (
     id              TEXT PRIMARY KEY,
     source_type     TEXT NOT NULL,
     publisher       TEXT NOT NULL,
     title           TEXT NOT NULL,
     canonical_url   TEXT NOT NULL UNIQUE,
     published_at    TEXT,
     accessed_at     TEXT,
     language        TEXT NOT NULL,
     market          TEXT NOT NULL,
     created_at      TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS evidence (
     id              TEXT PRIMARY KEY,
     claim           TEXT NOT NULL,
     subject         TEXT NOT NULL,
     evidence_type   TEXT NOT NULL,
     event_at        TEXT,
     observed_at     TEXT NOT NULL,
     market          TEXT NOT NULL,
     confidence      TEXT NOT NULL,
     fingerprint     TEXT NOT NULL UNIQUE,
     metadata_json   TEXT,
     created_at      TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS evidence_sources (
     evidence_id     TEXT NOT NULL,
     source_id       TEXT NOT NULL,
     PRIMARY KEY (evidence_id, source_id),
     FOREIGN KEY (evidence_id) REFERENCES evidence(id)          ON DELETE CASCADE,
     FOREIGN KEY (source_id)   REFERENCES source_documents(id)  ON DELETE CASCADE
   )`,

  `CREATE INDEX IF NOT EXISTS idx_evidence_market        ON evidence(market)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_type         ON evidence(evidence_type)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_observed_at   ON evidence(observed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_sources_sid  ON evidence_sources(source_id)`,
];

export const V2_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS exploration_runs (
     id              TEXT PRIMARY KEY,
     goal_json       TEXT NOT NULL,
     started_at      TEXT NOT NULL,
     completed_at    TEXT,
     status          TEXT NOT NULL,
     candidate_count INTEGER NOT NULL DEFAULT 0,
     accepted_count  INTEGER NOT NULL DEFAULT 0,
     rejected_count  INTEGER NOT NULL DEFAULT 0,
     error_message   TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_exploration_runs_started_at ON exploration_runs(started_at)`,
];

// P0002 final architecture rework — V3 adds the `runtime_id` column to
// `exploration_runs`. The column records the *public* identity of the
// Runtime that executed the run (as advertised by the adapter via
// `RuntimeAdapter.runtimeId`). It is the only Runtime-derived field
// persisted; no session id, no model name, no token count, no
// transport hint.
//
// SQLite has no `ADD COLUMN IF NOT EXISTS` in any supported version
// (3.49.2). The migration runner (init.ts) treats V3 statements as
// best-effort and skips "duplicate column" errors. Existing V2 DBs
// receive the column; fresh DBs (where V2 has just created the table)
// also receive it. Re-running V3 on a DB that already has the column
// is a no-op.
export const V3_DDL: readonly string[] = [
  `ALTER TABLE exploration_runs ADD COLUMN runtime_id TEXT NOT NULL DEFAULT 'unknown'`,
];
