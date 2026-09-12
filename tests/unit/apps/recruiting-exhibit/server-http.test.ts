// Basic view/API integration smoke test for POC-SURFACE-01:
// boots the real Node http server (startServer) against a
// temp-file exhibit database and a stubbed Hermes client, and
// exercises the frontend shell serving, SPA history fallback,
// static MIME types, traversal rejection, and the existing JSON
// APIs over HTTP. It does NOT trigger an observation run (that
// path is covered by observation.test.ts).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer as createNetServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { openExhibitDatabase } from '../../../../apps/recruiting-exhibit/db.js';
import { startServer, type StartedServer } from '../../../../apps/recruiting-exhibit/server.js';
import type { SqliteDatabase } from '../../../../storage/connection.js';
import type { HermesClient, HermesOneShotResult } from '../../../../runtime/hermes/types.js';

class UnusedStubClient implements HermesClient {
  isAvailable(): boolean {
    return false;
  }
  async oneShot(): Promise<HermesOneShotResult> {
    throw new Error('smoke test must not invoke Hermes');
  }
}

function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolvePort(port));
    });
  });
}

// Minimum run → source item → evidence → surfaced relationship
// chain required by the exhibit_feedback foreign key and by
// /api/inbox.
function seedSurfacedRelationship(database: SqliteDatabase): void {
  const ts = '2026-09-10T08:00:00.000Z';
  database
    .prepare(
      `INSERT INTO exhibit_observation_runs (id, kind, started_at, completed_at, status, new_evidence_count, new_relationship_count)
       VALUES ('run-1', 'manual', ?, ?, 'succeeded', 1, 1)`,
    )
    .run(ts, ts);
  database
    .prepare(
      `INSERT INTO exhibit_source_items (id, run_id, source_label, source_url, feed_url, dedup_key, captured_at, title, raw_excerpt, fetch_status)
       VALUES ('src-1', 'run-1', 'github-engineering', 'https://example.com/post', 'https://example.com/feed',
               'url:https://example.com/post', ?, 'Source title', 'raw excerpt text', 'ok')`,
    )
    .run(ts);
  database
    .prepare(
      `INSERT INTO exhibit_reconstructed_evidence (id, run_id, source_item_id, claim, implied_meaning, hypotheses_unknowns, created_at)
       VALUES ('ev-1', 'run-1', 'src-1', 'claim text', 'implied text', 'open question', ?)`,
    )
    .run(ts);
  database
    .prepare(
      `INSERT INTO exhibit_relationship_results (id, run_id, evidence_id, surface_decision, why_relevant, evidence_used, most_important_unknown, surfaced_at)
       VALUES ('rel-1', 'run-1', 'ev-1', 'surface', 'why relevant', 'evidence used', 'still unknown', ?)`,
    )
    .run(ts);
}

let workDir = '';
let db: SqliteDatabase | undefined;
let server: StartedServer | undefined;
let base = '';

beforeEach(async () => {
  workDir = mkdtempSync(resolve(tmpdir(), 'recruiting-exhibit-http-'));
  db = openExhibitDatabase(resolve(workDir, 'exhibit.db'));
  const port = await getFreePort();
  base = `http://127.0.0.1:${port}`;
  server = startServer({
    db,
    client: new UnusedStubClient(),
    port,
    now: () => new Date(),
    intervalMs: 3_600_000,
  });
  await server.ready;
});

afterEach(() => {
  server?.stop();
  server = undefined;
  db?.close();
  db = undefined;
  if (workDir.length > 0) rmSync(workDir, { recursive: true, force: true });
});

describe('static shell + SPA fallback', () => {
  it('serves the built frontend shell at /', async () => {
    const res = await fetch(base);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('id="root"');
    expect(html).toMatch(/\/assets\/.*\.js/);
  });

  it('serves the same shell for client-side routes (/meaning/:id, /radar)', async () => {
    const [detail, radar] = await Promise.all([
      fetch(`${base}/meaning/rel-1`),
      fetch(`${base}/radar`),
    ]);
    expect(detail.status).toBe(200);
    expect(radar.status).toBe(200);
    const detailHtml = await detail.text();
    expect(detailHtml).toContain('id="root"');
    expect(await radar.text()).toContain('id="root"');
  });

  it('serves copied public assets with the right MIME type', async () => {
    const res = await fetch(`${base}/images/hero.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
  });

  it('never serves files outside the static root for traversal-style paths', async () => {
    for (const evil of [
      '/images/..%2f..%2f..%2fpackage.json',
      '/%2e%2e/%2e%2e/package.json',
      '/assets/../../package.json',
    ]) {
      const res = await fetch(`${base}${evil}`);
      const body = await res.text();
      expect(body).not.toContain('better-sqlite3');
      expect(body).not.toContain('"engines"');
    }
  });
});

describe('existing JSON APIs over HTTP', () => {
  it('seeds the job-seeker demo Situation on first read', async () => {
    const res = await fetch(`${base}/api/situation`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rawText: string; updatedAt: string };
    expect(body.rawText).toContain('企业软件');
    expect(body.rawText).toContain('AI 时代');
    expect(typeof body.updatedAt).toBe('string');
  });

  it('persists an edited Situation and rejects empty text', async () => {
    const put = await fetch(`${base}/api/situation`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rawText: '  我正在转向 AI 应用方向。  ' }),
    });
    expect(put.status).toBe(200);

    const get = await fetch(`${base}/api/situation`);
    const body = (await get.json()) as { rawText: string };
    expect(body.rawText).toBe('我正在转向 AI 应用方向。');

    const bad = await fetch(`${base}/api/situation`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rawText: '   ' }),
    });
    expect(bad.status).toBe(400);
  });

  it('exposes status (including the Surface aggregate fields) and empty lists', async () => {
    const [status, inbox, feed] = await Promise.all([
      fetch(`${base}/api/status`),
      fetch(`${base}/api/inbox`),
      fetch(`${base}/api/feed`),
    ]);

    expect(status.status).toBe(200);
    const statusBody = (await status.json()) as Record<string, unknown>;
    expect(statusBody.totalEvidenceCount).toBe(0);
    expect(statusBody.totalSurfaces).toBe(0);
    expect(statusBody.lastRunStatus).toBeNull();

    const inboxBody = (await inbox.json()) as { entries: unknown[] };
    expect(inboxBody.entries).toEqual([]);
    const feedBody = (await feed.json()) as { entries: unknown[] };
    expect(feedBody.entries).toEqual([]);
  });

  it('returns the Surface read-only fields through /api/inbox for a surfaced relationship', async () => {
    seedSurfacedRelationship(db!);
    const res = await fetch(`${base}/api/inbox`);
    const body = (await res.json()) as {
      entries: ReadonlyArray<{
        relationshipId: string;
        sourceTitle: string;
        rawExcerpt: string;
        impliedMeaning: string;
        sourceUrl: string;
      }>;
    };
    expect(body.entries).toHaveLength(1);
    const entry = body.entries[0]!;
    expect(entry.relationshipId).toBe('rel-1');
    expect(entry.sourceTitle).toBe('Source title');
    expect(entry.rawExcerpt).toBe('raw excerpt text');
    expect(entry.impliedMeaning).toBe('implied text');
    expect(entry.sourceUrl).toBe('https://example.com/post');
  });

  it('accepts valid feedback against a real relationship and rejects unknown buttons', async () => {
    seedSurfacedRelationship(db!);

    const ok = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ relationshipId: 'rel-1', button: 'worth_talking' }),
    });
    expect(ok.status).toBe(204);

    const bad = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ relationshipId: 'rel-1', button: 'auto_apply' }),
    });
    expect(bad.status).toBe(400);
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
