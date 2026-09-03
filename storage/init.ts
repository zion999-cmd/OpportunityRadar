import type { SqliteDatabase } from './connection.js';
import { V1_DDL, V2_DDL, V3_DDL } from './schema.js';

// initSchema — apply all pending migrations to the storage substrate.
//
// Per P0001 §Migration Policy:
//   "schema_version 用来记录已经 applied 的 schema 版本。
//    每次 init 幂等：已经 applied 的 version 不再执行。
//    不要建 migration framework, v1 直接建表, v2 才会涉及迁移路径。"
//
// Implementation:
// - The schema_version table is created first so the current
//   version can be read.
// - On a fresh DB (no version row), every migration is applied
//   in a single transaction; the version row is written for
//   each migration as it lands.
// - On a DB at a prior version, only the migrations strictly
//   newer than the current version run, also in one transaction.
// - On a DB already at the latest version, the function is a
//   no-op.
//
// Idempotency policy:
// - Each DDL statement in V1 / V2 uses the SQLite-standard
//   `IF NOT EXISTS` form. Re-running a migration is a no-op.
// - V3 introduces an `ALTER TABLE ... ADD COLUMN` statement,
//   which is intrinsically non-idempotent (SQLite 3.49.2 has no
//   `ADD COLUMN IF NOT EXISTS`). For V3 (and any future
//   non-idempotent migration) the runner catches "duplicate
//   column" errors per-statement and continues, while letting
//   all other errors bubble up and roll the migration back.
//
// This is a *minimum-viable* migration runner, not a framework.

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

/** Migrations whose DDL is best-effort and tolerates "already applied" errors. */
const NON_IDEMPOTENT_MIGRATIONS: ReadonlySet<number> = new Set([3]);

interface Migration {
  version: number;
  ddl: readonly string[];
}

const MIGRATIONS: readonly Migration[] = [
  { version: 1, ddl: V1_DDL },
  { version: 2, ddl: V2_DDL },
  { version: 3, ddl: V3_DDL },
];

const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1];
export const SCHEMA_VERSION = (LATEST_MIGRATION ? LATEST_MIGRATION.version : 1) as 3;

interface SchemaVersionRow {
  v: number | null;
}

export function getSchemaVersion(db: SqliteDatabase): number | null {
  const row = db.prepare(SCHEMA_VERSION_GET_SQL).get() as SchemaVersionRow | undefined;
  return row?.v ?? null;
}

/**
 * Execute one DDL statement. For migrations in NON_IDEMPOTENT_MIGRATIONS,
 * swallow "duplicate column" errors and continue; everything else throws.
 * For idempotent migrations, every error throws.
 */
function execOne(db: SqliteDatabase, stmt: string, version: number): void {
  try {
    db.exec(stmt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (NON_IDEMPOTENT_MIGRATIONS.has(version) && /duplicate column name/i.test(message)) {
      // V3 ALTER TABLE ADD COLUMN on a DB that already has the column.
      // Idempotent re-run; not an error.
      return;
    }
    throw err;
  }
}

export function initSchema(db: SqliteDatabase): number {
  // Step 1: ensure the schema_version table exists so the current
  // version can be read. Idempotent.
  db.exec(SCHEMA_VERSION_DDL);

  // Step 2: short-circuit if already at the latest version.
  const current = getSchemaVersion(db);
  if (current !== null && current >= SCHEMA_VERSION) {
    return current;
  }

  // Step 3: apply pending migrations in a single transaction. If
  // any step throws, the whole migration rolls back.
  const apply = db.transaction(() => {
    for (const m of MIGRATIONS) {
      if (current !== null && m.version <= current) {
        continue;
      }
      for (const stmt of m.ddl) {
        execOne(db, stmt, m.version);
      }
      db.prepare(SCHEMA_VERSION_INSERT_SQL).run(m.version, new Date().toISOString());
    }
  });
  apply();

  return getSchemaVersion(db) ?? SCHEMA_VERSION;
}
