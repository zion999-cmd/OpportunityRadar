// apps/recruiting-exhibit/schema.ts — DDL for the recruiting-exhibit
// vertical slice.
//
// The exhibit is intentionally narrow: it stores only what the
// single-page UI needs to display. The schema is co-located with
// the exhibit and is not part of the P0001 / P0002 / investigation
// substrate.
//
// Tables:
//   exhibit_situation             — one row, the user's current raw Situation text
//   exhibit_observation_runs      — one row per scheduled or manual run
//   exhibit_source_items          — one row per fetched public source item
//   exhibit_reconstructed_evidence — one row per Evidence Reconstruction result
//   exhibit_relationship_results  — one row per Relationship Reasoning result
//   exhibit_feedback              — one row per inbox button click
//
// Every DDL statement uses `IF NOT EXISTS` so the runner is
// idempotent on an already-initialized DB.

export const EXHIBIT_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS exhibit_situation (
     id          INTEGER PRIMARY KEY CHECK (id = 1),
     raw_text    TEXT NOT NULL,
     updated_at  TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS exhibit_observation_runs (
     id                       TEXT PRIMARY KEY,
     kind                     TEXT NOT NULL CHECK (kind IN ('scheduled', 'manual')),
     started_at               TEXT NOT NULL,
     completed_at             TEXT,
     status                   TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
     new_evidence_count       INTEGER NOT NULL DEFAULT 0,
     new_relationship_count   INTEGER NOT NULL DEFAULT 0,
     error_message            TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_runs_started_at ON exhibit_observation_runs(started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_runs_status     ON exhibit_observation_runs(status)`,

  `CREATE TABLE IF NOT EXISTS exhibit_source_items (
     id            TEXT PRIMARY KEY,
     run_id        TEXT NOT NULL,
     source_label  TEXT NOT NULL,
     source_url    TEXT NOT NULL,
     feed_url      TEXT NOT NULL DEFAULT '',
     captured_at   TEXT NOT NULL,
     title         TEXT,
     raw_excerpt   TEXT NOT NULL,
     fetch_status  TEXT NOT NULL CHECK (fetch_status IN ('ok', 'failed')),
     fetch_error   TEXT,
     FOREIGN KEY (run_id) REFERENCES exhibit_observation_runs(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_sources_run_id ON exhibit_source_items(run_id)`,
  // The unique dedup invariant is NOT created here. On a
  // fresh DB it is fine, but on an old exhibit database
  // (created before the audit fix) the source_url column
  // stored the feed URL and the schema had no constraint,
  // so the same (source_label, source_url) pair may appear
  // many times. Creating the unique index before collapsing
  // those duplicates would fail. The index is created in
  // db.ts AFTER the old-DB dedup policy runs. See
  // DEFENSIVE_INDEXES there.

  `CREATE TABLE IF NOT EXISTS exhibit_reconstructed_evidence (
     id                    TEXT PRIMARY KEY,
     run_id                TEXT NOT NULL,
     source_item_id        TEXT NOT NULL,
     claim                 TEXT NOT NULL,
     implied_meaning       TEXT NOT NULL,
     hypotheses_unknowns   TEXT NOT NULL,
     created_at            TEXT NOT NULL,
     FOREIGN KEY (run_id)         REFERENCES exhibit_observation_runs(id) ON DELETE CASCADE,
     FOREIGN KEY (source_item_id) REFERENCES exhibit_source_items(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_evidence_run_id ON exhibit_reconstructed_evidence(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_evidence_source ON exhibit_reconstructed_evidence(source_item_id)`,

  `CREATE TABLE IF NOT EXISTS exhibit_relationship_results (
     id                       TEXT PRIMARY KEY,
     run_id                   TEXT NOT NULL,
     evidence_id              TEXT NOT NULL,
     surface_decision         TEXT NOT NULL CHECK (surface_decision IN ('surface', 'do_not_surface')),
     why_relevant             TEXT NOT NULL,
     evidence_used            TEXT NOT NULL,
     most_important_unknown   TEXT NOT NULL,
     surfaced_at              TEXT NOT NULL,
     FOREIGN KEY (run_id)     REFERENCES exhibit_observation_runs(id) ON DELETE CASCADE,
     FOREIGN KEY (evidence_id) REFERENCES exhibit_reconstructed_evidence(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_rels_run_id  ON exhibit_relationship_results(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_rels_surface ON exhibit_relationship_results(surface_decision)`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_rels_time    ON exhibit_relationship_results(surfaced_at)`,

  `CREATE TABLE IF NOT EXISTS exhibit_feedback (
     id                TEXT PRIMARY KEY,
     relationship_id   TEXT NOT NULL,
     button            TEXT NOT NULL CHECK (button IN ('worth_talking', 'investigate_more', 'not_relevant')),
     recorded_at       TEXT NOT NULL,
     FOREIGN KEY (relationship_id) REFERENCES exhibit_relationship_results(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_exhibit_feedback_rel_id ON exhibit_feedback(relationship_id)`,
];
