import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type SqliteDatabase } from '../../storage/connection.js';
import { initSchema, getSchemaVersion, SCHEMA_VERSION } from '../../storage/init.js';
import { V1_DDL, V2_DDL } from '../../storage/schema.js';
import {
  createSqliteRunRecorder,
  listRuns,
} from '../../exploration/repository/exploration-run-repository.js';
import type { ExplorationGoal } from '../../exploration/contracts/exploration-goal.js';

// Integration tests for the exploration_runs table + repository.

let db: SqliteDatabase;
let tmpDir: string;

const GOAL: ExplorationGoal = {
  id: 'goal-1',
  question: 'q',
  market: 'US',
  createdAt: '2026-09-03T10:00:00.000Z',
};

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'opportunity-radar-runs-'));
  db = openDatabase(join(tmpDir, 'test.db'));
  initSchema(db);
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Build a V2-only DB: apply V1 and V2 DDL, then write schema_version=2
 * directly. Used to simulate "an existing install at V2" so the
 * V3-migration test can prove the ALTER TABLE actually fires.
 */
function openV2OnlyDatabase(parentTmpDir: string): SqliteDatabase {
  const v2db = openDatabase(join(parentTmpDir, 'v2.db'));
  v2db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  for (const stmt of V1_DDL) v2db.exec(stmt);
  for (const stmt of V2_DDL) v2db.exec(stmt);
  v2db
    .prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)')
    .run(2, '2026-09-01T00:00:00.000Z');
  return v2db;
}

describe('initSchema — current schema version', () => {
  it('creates the exploration_runs table on a fresh DB at the latest version', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('exploration_runs');
    expect(names).toContain('evidence');
    expect(names).toContain('source_documents');
    expect(getSchemaVersion(db)).toBe(SCHEMA_VERSION);
  });

  it('is idempotent: re-running initSchema does not duplicate the version row', () => {
    initSchema(db);
    initSchema(db);
    const rows = db.prepare('SELECT COUNT(*) AS n FROM schema_version').get() as { n: number };
    expect(rows.n).toBe(SCHEMA_VERSION);
  });
});

describe('initSchema — V3 migration adds runtime_id', () => {
  it('migrates a V2 DB to V3 by adding the runtime_id column', () => {
    // Build a fresh V2-only DB in a separate tempdir so the
    // column is genuinely absent before initSchema runs.
    const v2Dir = mkdtempSync(join(tmpdir(), 'opportunity-radar-v2-'));
    try {
      const v2db = openV2OnlyDatabase(v2Dir);

      // Sanity: confirm the column does NOT exist yet (V2 only).
      const before = v2db
        .prepare(`PRAGMA table_info(exploration_runs)`)
        .all() as Array<{ name: string }>;
      expect(before.find((c) => c.name === 'runtime_id')).toBeUndefined();
      expect(getSchemaVersion(v2db)).toBe(2);

      initSchema(v2db);

      const after = v2db
        .prepare(`PRAGMA table_info(exploration_runs)`)
        .all() as Array<{ name: string }>;
      expect(after.find((c) => c.name === 'runtime_id')).toBeDefined();
      expect(getSchemaVersion(v2db)).toBe(SCHEMA_VERSION);
      v2db.close();
    } finally {
      rmSync(v2Dir, { recursive: true, force: true });
    }
  });

  it('idempotently handles a DB that already has the runtime_id column (no double-add error)', () => {
    // V3 is a non-idempotent ALTER TABLE. The migration runner
    // must catch the "duplicate column" error on re-run.
    initSchema(db);
    initSchema(db);
    const after = db
      .prepare(`PRAGMA table_info(exploration_runs)`)
      .all() as Array<{ name: string }>;
    expect(after.find((c) => c.name === 'runtime_id')).toBeDefined();
    expect(getSchemaVersion(db)).toBe(SCHEMA_VERSION);
  });
});

describe('exploration_runs repository — writes and reads', () => {
  it('persists a started run with status=running, completed_at=null, runtime_id set', () => {
    const recorder = createSqliteRunRecorder(db);
    recorder.startRun('run-1', GOAL, 'hermes', '2026-09-03T10:00:00.000Z');
    const row = db
      .prepare('SELECT * FROM exploration_runs WHERE id = ?')
      .get('run-1') as { status: string; completed_at: string | null; goal_json: string; runtime_id: string };
    expect(row.status).toBe('running');
    expect(row.completed_at).toBeNull();
    expect(row.runtime_id).toBe('hermes');
    expect(JSON.parse(row.goal_json)).toEqual(GOAL);
  });

  it('updates counts via setCounts', () => {
    const recorder = createSqliteRunRecorder(db);
    recorder.startRun('run-1', GOAL, 'hermes', '2026-09-03T10:00:00.000Z');
    recorder.setCounts('run-1', 5, 3, 2);
    const row = db
      .prepare('SELECT * FROM exploration_runs WHERE id = ?')
      .get('run-1') as { candidate_count: number; accepted_count: number; rejected_count: number };
    expect(row.candidate_count).toBe(5);
    expect(row.accepted_count).toBe(3);
    expect(row.rejected_count).toBe(2);
  });

  it('updates final state via setFinal (success path)', () => {
    const recorder = createSqliteRunRecorder(db);
    recorder.startRun('run-1', GOAL, 'hermes', '2026-09-03T10:00:00.000Z');
    recorder.setFinal('run-1', {
      completedAt: '2026-09-03T10:05:00.000Z',
      status: 'succeeded',
      errorMessage: null,
    });
    const row = db
      .prepare('SELECT * FROM exploration_runs WHERE id = ?')
      .get('run-1') as { status: string; completed_at: string; error_message: string | null };
    expect(row.status).toBe('succeeded');
    expect(row.completed_at).toBe('2026-09-03T10:05:00.000Z');
    expect(row.error_message).toBeNull();
  });

  it('updates final state via setFinal (failure path)', () => {
    const recorder = createSqliteRunRecorder(db);
    recorder.startRun('run-1', GOAL, 'hermes', '2026-09-03T10:00:00.000Z');
    recorder.setFinal('run-1', {
      completedAt: '2026-09-03T10:05:00.000Z',
      status: 'failed',
      errorMessage: 'hermes: binary not found',
    });
    const row = db
      .prepare('SELECT error_message FROM exploration_runs WHERE id = ?')
      .get('run-1') as { error_message: string };
    expect(row.error_message).toBe('hermes: binary not found');
  });
});

describe('exploration_runs repository — round-trip and queries', () => {
  it('round-trips the goal JSON including optional fields', () => {
    const recorder = createSqliteRunRecorder(db);
    const goalWithOptional: ExplorationGoal = {
      ...GOAL,
      timeWindow: 'last_30_days',
      evidenceInterests: ['funding', 'acquisition'],
    };
    recorder.startRun('run-1', goalWithOptional, 'hermes', '2026-09-03T10:00:00.000Z');
    const retrieved = recorder.getRun('run-1');
    expect(retrieved?.goal).toEqual(goalWithOptional);
    expect(retrieved?.runtimeId).toBe('hermes');
  });

  it('returns undefined for an unknown run id', () => {
    const recorder = createSqliteRunRecorder(db);
    expect(recorder.getRun('unknown')).toBeUndefined();
  });

  it('lists runs in reverse-chronological order', () => {
    const recorder = createSqliteRunRecorder(db);
    recorder.startRun('run-1', GOAL, 'hermes', '2026-09-03T10:00:00.000Z');
    recorder.startRun('run-2', GOAL, 'hermes', '2026-09-03T10:05:00.000Z');
    recorder.startRun('run-3', GOAL, 'hermes', '2026-09-03T10:10:00.000Z');
    const runs = listRuns(db, 10);
    expect(runs.map((r) => r.id)).toEqual(['run-3', 'run-2', 'run-1']);
  });

  it('listRuns honors the limit parameter', () => {
    const recorder = createSqliteRunRecorder(db);
    for (let i = 0; i < 5; i += 1) {
      recorder.startRun(`run-${i}`, GOAL, 'hermes', `2026-09-03T10:0${i}:00.000Z`);
    }
    expect(listRuns(db, 3)).toHaveLength(3);
  });
});
