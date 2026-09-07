// apps/recruiting-exhibit/db.ts — opens the exhibit's SQLite file
// and applies the exhibit DDL.
//
// Per task.md: "用最小实现。SQLite 即可。" — we co-locate the
// exhibit with the existing dev.db at `data/dev.db` so a single
// process can host both the Radar core tables and the exhibit
// tables. The exhibit only ever reads from / writes to its own
// `exhibit_*` tables; the rest of the schema is left alone.

import { openDatabase, type SqliteDatabase } from '../../storage/connection.js';
import { EXHIBIT_DDL } from './schema.js';

export const DEFAULT_EXHIBIT_DB_PATH = 'data/dev.db';

export function openExhibitDatabase(path: string = DEFAULT_EXHIBIT_DB_PATH): SqliteDatabase {
  const db = openDatabase(path);
  applyExhibitDdl(db);
  return db;
}

function applyExhibitDdl(db: SqliteDatabase): void {
  for (const stmt of EXHIBIT_DDL) {
    db.exec(stmt);
  }
}
