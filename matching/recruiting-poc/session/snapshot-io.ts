import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSnapshot, snapshotFromTimeline, type SessionSnapshot } from './snapshot.js';
import type { SessionTimeline } from './runtime.js';

// matching/recruiting-poc/session/snapshot-io.ts —
// thin fs wrapper around the pure snapshot helpers.
//
// The location convention is:
//   artifacts/recruiting-poc/snapshots/<iso-ts>_recruiting-poc-session.snapshot.json
//
// Snapshots live in their own sub-namespace, separate from
// artifacts. Snapshots are resume tokens, not artifacts.

const SNAPSHOTS_DIR = resolve(
  process.cwd(),
  'artifacts',
  'recruiting-poc',
  'snapshots',
);

function defaultSnapshotPath(): string {
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${safeTimestamp}_recruiting-poc-session.snapshot.json`;
  return resolve(SNAPSHOTS_DIR, fileName);
}

/**
 * Write a `SessionSnapshot` derived from the given timeline to a
 * JSON file. Returns the absolute file path. Creates the
 * snapshots directory if needed.
 */
export function writeSessionSnapshot(
  timeline: SessionTimeline,
  filePath?: string,
): string {
  const path = filePath ?? defaultSnapshotPath();
  mkdirSync(resolve(path, '..'), { recursive: true });
  const snap = snapshotFromTimeline(timeline);
  writeFileSync(path, JSON.stringify(snap, null, 2), 'utf-8');
  return path;
}

/**
 * Read a snapshot from a JSON file. Throws on I/O error,
 * malformed JSON, or schema-validation failure.
 */
export function readSessionSnapshot(filePath: string): SessionSnapshot {
  const body = readFileSync(filePath, 'utf-8');
  return parseSnapshot(body);
}
