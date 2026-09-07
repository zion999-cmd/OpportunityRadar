// apps/recruiting-exhibit/server.ts — single-page HTTP server.
//
// Per task.md, the page needs only four sections, and the API
// surface is correspondingly small. We use Node's built-in
// `http` module only — no Express, no Koa, no Fastify. The
// exhibit is a vertical slice, not a production web service.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import type { HermesClient } from '../../runtime/hermes/types.js';
import type { SqliteDatabase } from '../../storage/connection.js';
import { runObservation, type RunResult } from './observation.js';
import { readSituation, writeSituation } from './situation-repo.js';
import { readFeed, readInbox, readStatus, recordFeedback } from './views.js';

export interface ServerDeps {
  readonly db: SqliteDatabase;
  readonly client: HermesClient;
  readonly port: number;
  readonly now: () => Date;
  /** Interval (ms) for the scheduled observation loop. */
  readonly intervalMs: number;
}

const STATIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'static');

interface JsonError {
  readonly error: string;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function startServer(deps: ServerDeps): { stop: () => void; triggerNow: () => Promise<RunResult> } {
  const { db, client, port, now, intervalMs } = deps;
  const triggerNow = (): Promise<RunResult> => runObservation({ db, client, now }, 'manual');

  // Hourly schedule. The interval is set on boot and is not
  // reconfigured at runtime — the task spec says "每轮哪怕只有
  // 5~20 条新 Evidence 都可以"; the page also exposes a manual
  // "Run observation now" button.
  const schedule = setInterval(() => {
    runObservation({ db, client, now }, 'scheduled').catch(() => {
      // Errors are persisted on the run row; nothing else to do.
    });
  }, intervalMs);
  // Allow the process to exit even if the interval is still set.
  schedule.unref();

  const server = createServer((req, res) => handle(req, res, { db, triggerNow }));
  server.listen(port, () => {
    process.stdout.write(`recruiting-exhibit listening on http://127.0.0.1:${port}\n`);
  });

  return {
    stop: () => {
      clearInterval(schedule);
      server.close();
    },
    triggerNow,
  };
}

interface HandleDeps {
  readonly db: SqliteDatabase;
  readonly triggerNow: () => Promise<RunResult>;
}

async function handle(req: IncomingMessage, res: ServerResponse, deps: HandleDeps): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  const method = req.method ?? 'GET';

  // Static
  if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    serveStatic(res, 'index.html');
    return;
  }
  if (method === 'GET' && url.pathname.startsWith('/static/')) {
    serveStatic(res, url.pathname.replace(/^\/static\//, ''));
    return;
  }

  // API
  if (method === 'GET' && url.pathname === '/api/situation') {
    return json(res, 200, readSituation(deps.db));
  }
  if (method === 'PUT' && url.pathname === '/api/situation') {
    const body = await readJson(req);
    if (typeof body?.rawText !== 'string') return json(res, 400, { error: 'rawText required' } satisfies JsonError);
    try {
      const row = writeSituation(deps.db, body.rawText);
      return json(res, 200, row);
    } catch (err) {
      return json(res, 400, { error: err instanceof Error ? err.message : String(err) } satisfies JsonError);
    }
  }
  if (method === 'GET' && url.pathname === '/api/status') {
    return json(res, 200, readStatus(deps.db));
  }
  if (method === 'GET' && url.pathname === '/api/inbox') {
    return json(res, 200, { entries: readInbox(deps.db) });
  }
  if (method === 'GET' && url.pathname === '/api/feed') {
    return json(res, 200, { entries: readFeed(deps.db) });
  }
  if (method === 'POST' && url.pathname === '/api/observation/run') {
    const result = await deps.triggerNow();
    return json(res, 202, result);
  }
  if (method === 'POST' && url.pathname === '/api/feedback') {
    const body = await readJson(req);
    const relationshipId = typeof body?.relationshipId === 'string' ? body.relationshipId : null;
    const button = typeof body?.button === 'string' ? body.button : null;
    if (relationshipId === null || button === null) {
      return json(res, 400, { error: 'relationshipId and button required' } satisfies JsonError);
    }
    if (button !== 'worth_talking' && button !== 'investigate_more' && button !== 'not_relevant') {
      return json(res, 400, { error: 'unknown button' } satisfies JsonError);
    }
    try {
      recordFeedback(deps.db, relationshipId, button);
      return json(res, 204, null);
    } catch (err) {
      return json(res, 400, { error: err instanceof Error ? err.message : String(err) } satisfies JsonError);
    }
  }

  json(res, 404, { error: 'not found' } satisfies JsonError);
}

function serveStatic(res: ServerResponse, name: string): void {
  // Sanitize: reject path traversal and only allow plain filenames.
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    json(res, 404, { error: 'not found' });
    return;
  }
  const path = resolve(STATIC_DIR, name);
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    json(res, 404, { error: 'not found' });
    return;
  }
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' });
  res.end(buf);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolveBody) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) { resolveBody(null); return; }
      try { resolveBody(JSON.parse(raw) as Record<string, unknown>); }
      catch { resolveBody(null); }
    });
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': MIME['.json'] });
  if (body === null) { res.end(); return; }
  res.end(JSON.stringify(body));
}
