import { resolve } from 'node:path';
import { openDatabase } from '../storage/connection.js';
import { initSchema, getSchemaVersion } from '../storage/init.js';

// scripts/db-init — `npm run db:init`.
//
// Creates (or opens) data/dev.db at the repository root, applies
// the schema, and prints the resulting schema_version. This is
// the P0001 "first run" entry point and the smoke target.

const DEFAULT_DB_PATH = resolve(process.cwd(), 'data', 'dev.db');

function main(): void {
  const dbPath = process.env['OPPORTUNITY_RADAR_DB'] ?? DEFAULT_DB_PATH;
  const db = openDatabase(dbPath);
  try {
    const version = initSchema(db);
    // Re-read so we confirm the row landed, not just that the call
    // returned a number.
    const persisted = getSchemaVersion(db);
    process.stdout.write(`db_init: path=${dbPath} schema_version=${persisted ?? 'unknown'}\n`);
    if (persisted !== version) {
      process.stderr.write(`db_init: warning — return value ${version} != persisted ${persisted}\n`);
    }
  } finally {
    db.close();
  }
}

main();
