import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openExhibitDatabase } from '../../../../apps/recruiting-exhibit/db.js';
import { FIXED_SOURCES } from '../../../../apps/recruiting-exhibit/sources.js';
import { runObservation } from '../../../../apps/recruiting-exhibit/observation.js';
import { readInbox, readFeed, readStatus, recordFeedback } from '../../../../apps/recruiting-exhibit/views.js';
import { readSituation, writeSituation } from '../../../../apps/recruiting-exhibit/situation-repo.js';
import type { HermesClient, HermesOneShotRequest, HermesOneShotResult } from '../../../../runtime/hermes/types.js';

class StubClient implements HermesClient {
  readonly calls: HermesOneShotRequest[] = [];
  private outputs: string[];
  constructor(outputs: string[]) { this.outputs = [...outputs]; }
  isAvailable() { return true; }
  async oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult> {
    this.calls.push(req);
    const next = this.outputs.shift();
    if (next === undefined) throw new Error('stub: no more queued outputs');
    return { stdout: next, exitCode: 0, durationMs: 1 };
  }
}

const evidenceStdout = (claim: string) => `preamble
{"directly_supported":"${claim}","implied_meaning":"implies deep bar","hypotheses_unknowns":"ownership not stated"}`;
const relationshipStdout = (decision: 'surface' | 'do_not_surface', why = 'matches the situation') =>
  `preamble
{"surface_decision":"${decision}","why_relevant":"${why}","evidence_used":"specific evidence body","most_important_unknown":"specific unknown"}`;

const sampleRssFor = (title: string) => `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>${title}</title>
    <link>https://example.com/${encodeURIComponent(title)}</link>
    <description>postmortem excerpt about ${title}</description>
  </item>
</channel></rss>`;

let workDir = '';
let dbPath = '';
let db: ReturnType<typeof openExhibitDatabase> | undefined;
let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  workDir = mkdtempSync(resolve(tmpdir(), 'recruiting-exhibit-'));
  dbPath = resolve(workDir, 'exhibit.db');
  db = openExhibitDatabase(dbPath);
  originalFetch = globalThis.fetch;
  // Stub global fetch so observation runs do not hit the
  // public internet from tests. Each call returns a small
  // RSS-shaped body whose title cycles through three values.
  let i = 0;
  const titles = ['postmortem alpha', 'retro bravo', 'incident charlie'];
  globalThis.fetch = (async (url: string | URL | Request) => {
    void url;
    const title = titles[i % titles.length] ?? 'default';
    i += 1;
    return new Response(sampleRssFor(title), {
      status: 200,
      headers: { 'content-type': 'application/rss+xml' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  db?.close();
  db = undefined;
  if (originalFetch !== undefined) globalThis.fetch = originalFetch;
  if (workDir.length > 0) rmSync(workDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('recruiting-exhibit situation repo', () => {
  it('seeds the default situation on first read', () => {
    const row = readSituation(db!);
    expect(row.rawText.length).toBeGreaterThan(20);
  });

  it('persists user edits and refuses empty input', () => {
    writeSituation(db!, '   new situation   ');
    const reloaded = readSituation(db!);
    expect(reloaded.rawText).toBe('new situation');
    expect(() => writeSituation(db!, '   ')).toThrow();
  });
});

describe('recruiting-exhibit observation run', () => {
  it('records a successful run with the expected schema and counts', async () => {
    // Pre-queue enough stub outputs to cover the
    // FIXED_SOURCES count. The fetcher is also stubbed so
    // every source returns one item. All relationships surface
    // here so the count equals the item count.
    const queue: string[] = [];
    const totalItems = FIXED_SOURCES.length; // one item per source
    for (let n = 0; n < totalItems; n += 1) {
      queue.push(evidenceStdout(`claim ${n}`));
      queue.push(relationshipStdout('surface', `reason ${n}`));
    }
    const client = new StubClient(queue);
    const result = await runObservation({ db: db!, client, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    expect(result.status).toBe('succeeded');
    expect(result.newEvidenceCount).toBe(totalItems);
    expect(result.newRelationshipCount).toBe(totalItems);
  });

  it('records feedback and exposes inbox / feed reads', async () => {
    const queue: string[] = [];
    for (let n = 0; n < FIXED_SOURCES.length; n += 1) {
      queue.push(evidenceStdout(`claim ${n}`));
      queue.push(relationshipStdout('surface', `reason ${n}`));
    }
    const client = new StubClient(queue);
    await runObservation({ db: db!, client, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    const inbox = readInbox(db!);
    const feed = readFeed(db!);
    expect(inbox.length).toBe(FIXED_SOURCES.length);
    expect(feed.length).toBe(FIXED_SOURCES.length);
    if (inbox[0] !== undefined) {
      recordFeedback(db!, inbox[0].relationshipId, 'worth_talking');
      recordFeedback(db!, inbox[0].relationshipId, 'investigate_more');
    }
    const status = readStatus(db!, { intervalMs: 60 * 60 * 1000 });
    expect(status.lastObservationAt).not.toBeNull();
    expect(status.totalSurfaces).toBe(FIXED_SOURCES.length);
  });

  it('rejects an unknown feedback button', () => {
    expect(() => recordFeedback(db!, 'rel-id', 'not_a_button' as never)).toThrow();
  });
});
