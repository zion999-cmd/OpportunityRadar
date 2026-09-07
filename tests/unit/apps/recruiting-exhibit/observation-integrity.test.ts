// Focused tests for the Live Observation Integrity Fix. Each
// describe block maps to one of the audit findings:
//
//   1. Source item dedup via (source_label, source_url)
//   2. Real article URL preserved as source_url, feed_url
//      recorded separately
//   3. Partial failure observability (error_message recorded
//      on the run row, surfaced via readStatus().lastError)
//   4. Surface-only count for new_relationship_count
//   5. Process-local concurrency guard
//   6. nextObservationAt is computed against the actual
//      intervalMs the server is running on
//
// All tests use the in-process Hermes stub and a stubbed
// global fetch so they do not touch the public internet.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openExhibitDatabase } from '../../../../apps/recruiting-exhibit/db.js';
import { FIXED_SOURCES } from '../../../../apps/recruiting-exhibit/sources.js';
import { runObservation } from '../../../../apps/recruiting-exhibit/observation.js';
import { readStatus, type InboxEntry, type FeedEntry } from '../../../../apps/recruiting-exhibit/views.js';
import type { HermesClient, HermesOneShotRequest, HermesOneShotResult } from '../../../../runtime/hermes/types.js';

class StubClient implements HermesClient {
  readonly calls: HermesOneShotRequest[] = [];
  // outputs is consumed FIFO; one entry per expected oneShot
  // call. Throwing outputs are pre-formatted invalid JSON so
  // parseEvidenceReconstruction / parseRelationshipReasoning
  // fail and trigger the error path.
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
    <link>https://example.com/articles/${encodeURIComponent(title)}</link>
    <description>postmortem excerpt about ${title}</description>
  </item>
</channel></rss>`;

let workDir = '';
let dbPath = '';
let db: ReturnType<typeof openExhibitDatabase> | undefined;
let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  workDir = mkdtempSync(resolve(tmpdir(), 'recruiting-exhibit-integrity-'));
  dbPath = resolve(workDir, 'exhibit.db');
  db = openExhibitDatabase(dbPath);
  originalFetch = globalThis.fetch;
  let i = 0;
  const titles = ['postmortem alpha', 'retro bravo', 'incident charlie', 'outage delta'];
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

function queueFor(n: number, decision: 'surface' | 'do_not_surface' = 'surface'): string[] {
  const q: string[] = [];
  for (let k = 0; k < n; k += 1) {
    q.push(evidenceStdout(`claim ${k}`));
    q.push(relationshipStdout(decision, `reason ${k}`));
  }
  return q;
}

describe('audit fix #1: source item dedup', () => {
  it('skips previously-seen items on the second run (zero model calls, newEvidenceCount=0)', async () => {
    const client1 = new StubClient(queueFor(FIXED_SOURCES.length, 'surface'));
    const first = await runObservation({ db: db!, client: client1, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    expect(first.status).toBe('succeeded');
    expect(first.newEvidenceCount).toBe(FIXED_SOURCES.length);
    const firstCalls = client1.calls.length;

    // Second run uses a brand-new client with no queued
    // outputs. If the dedup is broken the orchestrator will
    // try to drain the empty queue and throw.
    const client2 = new StubClient([]);
    const second = await runObservation({ db: db!, client: client2, now: () => new Date('2026-09-07T12:30:00Z') }, 'manual');

    expect(second.status).toBe('succeeded');
    expect(second.newEvidenceCount).toBe(0);
    expect(second.newRelationshipCount).toBe(0);
    // Crucial: the second run must make ZERO Hermes calls
    // for the already-seen items.
    expect(client2.calls.length).toBe(0);
    expect(firstCalls).toBeGreaterThan(0); // sanity: first run did call Hermes
  });
});

describe('audit fix #2: real article URL is preserved', () => {
  it('saves item.url as source_url and the source feed URL as feed_url, both visible via the inbox/feed', async () => {
    const client = new StubClient(queueFor(FIXED_SOURCES.length, 'surface'));
    await runObservation({ db: db!, client, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');

    // Use readInbox/readFeed via the public views API to
    // confirm both the article URL and the originating feed
    // URL are visible end-to-end.
    const inbox = (await import('../../../../apps/recruiting-exhibit/views.js')).readInbox(db!) as ReadonlyArray<InboxEntry>;
    const feed = (await import('../../../../apps/recruiting-exhibit/views.js')).readFeed(db!) as ReadonlyArray<FeedEntry>;
    expect(inbox.length).toBe(FIXED_SOURCES.length);
    expect(feed.length).toBe(FIXED_SOURCES.length);

    for (const entry of inbox) {
      // Article URL: real, distinct from the feed URL.
      expect(entry.sourceUrl).toMatch(/^https:\/\/example\.com\/articles\//);
      // Feed URL: one of the FIXED_SOURCES feed URLs.
      const knownFeedUrls = new Set(FIXED_SOURCES.map((s) => s.url));
      expect(knownFeedUrls.has(entry.feedUrl)).toBe(true);
    }
    for (const entry of feed) {
      expect(entry.sourceUrl).toMatch(/^https:\/\/example\.com\/articles\//);
      const knownFeedUrls = new Set(FIXED_SOURCES.map((s) => s.url));
      expect(knownFeedUrls.has(entry.feedUrl)).toBe(true);
    }
  });
});

describe('audit fix #3: partial failure observability', () => {
  it('records item-level errors on the run row and surfaces them via readStatus().lastError', async () => {
    // The reconstruction prompt is parsed by
    // parseEvidenceReconstruction. If we feed it invalid
    // JSON, the parse throws and the item is recorded as
    // failed. The run itself still completes.
    const client = new StubClient(['this is not json', 'also not json', 'me neither', 'still not json']);
    const result = await runObservation({ db: db!, client, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    // We tried to process items but every one failed — the
    // run must be marked 'failed', not silently 'succeeded'.
    expect(result.status).toBe('failed');
    expect(result.newEvidenceCount).toBe(0);
    expect(result.errorMessage).not.toBeNull();
    expect(result.errorMessage ?? '').toContain('items_failed=');

    const status = readStatus(db!, { intervalMs: 60 * 60 * 1000 });
    expect(status.lastRunStatus).toBe('failed');
    expect(status.lastError).not.toBeNull();
    expect(status.lastError ?? '').toContain('items_failed=');
  });

  it('records succeeded with an error summary when SOME items failed but others succeeded', async () => {
    // The orchestrator should not roll the whole run to
    // 'failed' just because one item failed. It must
    // persist the per-item error and still mark the run
    // 'succeeded' (work landed).
    // Build a queue: first call (item 0) is bad JSON; the
    // remaining 3*(FIXED_SOURCES.length-1) outputs are good.
    const queue: string[] = [];
    queue.push('not valid json');
    for (let k = 0; k < FIXED_SOURCES.length - 1; k += 1) {
      queue.push(evidenceStdout(`claim ${k}`));
      queue.push(relationshipStdout('surface', `reason ${k}`));
    }
    const client = new StubClient(queue);
    const result = await runObservation({ db: db!, client, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    expect(result.status).toBe('succeeded');
    expect(result.newEvidenceCount).toBe(FIXED_SOURCES.length - 1);
    expect(result.errorMessage).not.toBeNull();
    expect(result.errorMessage ?? '').toContain('items_failed=');

    const status = readStatus(db!, { intervalMs: 60 * 60 * 1000 });
    expect(status.lastRunStatus).toBe('succeeded');
    expect(status.lastError).not.toBeNull();
  });
});

describe('audit fix #4: surface-only relationship count', () => {
  it('counts only surface decisions, not do_not_surface', async () => {
    // Interleave decisions: half surface, half do_not_surface.
    const queue: string[] = [];
    for (let k = 0; k < FIXED_SOURCES.length; k += 1) {
      queue.push(evidenceStdout(`claim ${k}`));
      const decision: 'surface' | 'do_not_surface' = k % 2 === 0 ? 'surface' : 'do_not_surface';
      queue.push(relationshipStdout(decision, `reason ${k}`));
    }
    const client = new StubClient(queue);
    const result = await runObservation({ db: db!, client, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    expect(result.status).toBe('succeeded');
    // newEvidenceCount is every item; newRelationshipCount is
    // the surface subset.
    expect(result.newEvidenceCount).toBe(FIXED_SOURCES.length);
    const expectedSurfaces = Math.ceil(FIXED_SOURCES.length / 2);
    expect(result.newRelationshipCount).toBe(expectedSurfaces);
  });

  it('returns zero new_relationship_count when all items are do_not_surface', async () => {
    const client = new StubClient(queueFor(FIXED_SOURCES.length, 'do_not_surface'));
    const result = await runObservation({ db: db!, client, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    expect(result.status).toBe('succeeded');
    expect(result.newEvidenceCount).toBe(FIXED_SOURCES.length);
    expect(result.newRelationshipCount).toBe(0);
  });
});

describe('audit fix #5: concurrency guard', () => {
  it('a second run started while the first is in progress returns status=skipped', async () => {
    // Slow stub: each oneShot takes 30ms. With
    // FIXED_SOURCES.length * 2 calls per run, the first run
    // will be in flight when the second run starts.
    class SlowStub implements HermesClient {
      readonly calls: HermesOneShotRequest[] = [];
      isAvailable() { return true; }
      async oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult> {
        this.calls.push(req);
        await new Promise((r) => setTimeout(r, 30));
        // Use the index modulo to alternate decisions.
        const idx = this.calls.length - 1;
        const isEvidenceCall = idx % 2 === 0;
        const evidence = idx % 4 === 0 ? 'postmortem alpha' : 'retro bravo';
        const decision: 'surface' | 'do_not_surface' = idx % 4 < 2 ? 'surface' : 'do_not_surface';
        const stdout = isEvidenceCall
          ? evidenceStdout(evidence)
          : relationshipStdout(decision);
        return { stdout, exitCode: 0, durationMs: 30 };
      }
    }
    const slow = new SlowStub();
    const firstP = runObservation({ db: db!, client: slow, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    // Give the first run a moment to enter the in-flight
    // window; then start a second run.
    await new Promise((r) => setTimeout(r, 5));
    const second = await runObservation({ db: db!, client: slow, now: () => new Date('2026-09-07T12:00:00Z') }, 'manual');
    expect(second.status).toBe('skipped');
    expect(second.errorMessage).toMatch(/in progress/i);
    const first = await firstP;
    // The first run still completes normally.
    expect(first.status).toBe('succeeded');
  });
});

describe('audit fix #6: readStatus uses the real intervalMs', () => {
  it('nextObservationAt equals lastObservationAt + intervalMs', async () => {
    const client = new StubClient(queueFor(FIXED_SOURCES.length, 'surface'));
    const startedAt = new Date('2026-09-07T12:00:00Z');
    await runObservation({ db: db!, client, now: () => startedAt }, 'manual');
    const intervalMs = 90 * 60 * 1000;
    const status = readStatus(db!, { intervalMs });
    expect(status.lastObservationAt).not.toBeNull();
    const expectedNext = new Date(startedAt.getTime() + intervalMs).toISOString();
    expect(status.nextObservationAt).toBe(expectedNext);
  });

  it('a different intervalMs produces a different nextObservationAt', async () => {
    const client = new StubClient(queueFor(FIXED_SOURCES.length, 'surface'));
    const startedAt = new Date('2026-09-07T12:00:00Z');
    await runObservation({ db: db!, client, now: () => startedAt }, 'manual');
    const oneHour = readStatus(db!, { intervalMs: 60 * 60 * 1000 });
    const twoHour = readStatus(db!, { intervalMs: 2 * 60 * 60 * 1000 });
    expect(oneHour.nextObservationAt).not.toBeNull();
    expect(twoHour.nextObservationAt).not.toBeNull();
    if (oneHour.nextObservationAt !== null && twoHour.nextObservationAt !== null) {
      const diff = Date.parse(twoHour.nextObservationAt) - Date.parse(oneHour.nextObservationAt);
      expect(diff).toBe(60 * 60 * 1000);
    }
  });
});
