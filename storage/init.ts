import type { SqliteDatabase } from './connection.js';
import { SCHEMA_VERSION, V1_DDL } from './schema.js';

// initSchema — apply the storage substrate's schema.
//
// Per P0001 §Migration Policy:
//   "schema_version 用来记录已经应用的 schema 版本。
//    每次 init 幂等：已经 applied 的 version 不再执行。
//    不要建 migration framework，v1 直接建表，v2 才会涉及迁移路径。"
//
// Behaviour:
// - On a fresh DB, the schema_version table is empty → apply all
//   v1 DDL inside a transaction, then record version=1.
// - On a DB already at version 1 (or any later version), the
//   function is a no-op: the DDL is `IF NOT EXISTS` and the
//   version row is unchanged.
//
// Returns the schema version that is now current. This is what
// `npm run db:init` prints and what later Proposal migrations
// will branch on.

const SCHEMA_VERSION_DDL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`;

const SCHEMA_VERSION_INSERT_SQL = `
  INSERT INTO schema_version (version, applied_at) VALUES (?, ?)
`;

const SCHEMA_VERSION_GET_SQL = `
  SELECT MAX(version) AS v FROM schema_version
`;

interface SchemaVersionRow {
  v: number | null;
}

export function getSchemaVersion(db: SqliteDatabase): number | null {
  const row = db.prepare(SCHEMA_VERSION_GET_SQL).get() as SchemaVersionRow | undefined;
  return row?.v ?? null;
}

export function initSchema(db: SqliteDatabase): number {
  // Step 1: ensure the schema_version table exists so we can ask
  // what the current version is. Idempotent.
  db.exec(SCHEMA_VERSION_DDL);

  // Step 2: short-circuit if already initialized.
  const current = getSchemaVersion(db);
  if (current !== null) {
    return current;
  }

  // Step 3: fresh init — apply all v1 DDL in one transaction so a
  // partial failure rolls back cleanly.
  const applyV1 = db.transaction(() => {
    for (const stmt of V1_DDL) {
      db.exec(stmt);
    }
    db.prepare(SCHEMA_VERSION_INSERT_SQL).run(SCHEMA_VERSION, new Date().toISOString());
  });
  applyV1();

  return SCHEMA_VERSION;
}
