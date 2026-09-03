import Database from 'better-sqlite3';

// Re-export the Database instance type so consumers don't have to
// depend on better-sqlite3's import shape.
export type SqliteDatabase = ReturnType<typeof Database>;

// openDatabase — open (or create) a SQLite database file and apply
// the storage substrate's baseline PRAGMAs.
//
// Per P0001 §Storage Substrate:
// - journal_mode = WAL  — concurrent reads while a writer is active
// - foreign_keys = ON   — required for the evidence_sources join to
//                         enforce referential integrity
// - busy_timeout = 5000 — wait up to 5s for a contended lock instead
//                         of immediately failing
//
// No connection pooling, no migration framework, no ORM. P0001 is
// a single-process, single-DB substrate. Anything beyond that is
// out of scope until a future Proposal says otherwise.

export function openDatabase(path: string): SqliteDatabase {
  const db = Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}
