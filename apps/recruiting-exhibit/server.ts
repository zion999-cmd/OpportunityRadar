// apps/recruiting-exhibit/server.ts — single-page HTTP server.
//
// Per task.md, the page needs only four sections, and the API
// surface is correspondingly small. We use Node's built-in
// `http` module only — no Express, no Koa, no Fastify. The
// exhibit is a vertical slice, not a production web service.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import type { HermesClient } from '../../runtime/hermes/types.js';
import type { SqliteDatabase } from '../../storage/connection.js';
import { runObservation, type RunResult } from './observation.js';
import { readSituation, writeSituation } from './situation-repo.js';
import { readFeed, readInbox, readStatus, recordFeedback, type ScheduleConfig } from './views.js';

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
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface StartedServer {
  stop(): void;
  triggerNow(): Promise<RunResult>;
  /** Resolves once the HTTP socket is accepting connections. */
  ready: Promise<void>;
}

export function startServer(deps: ServerDeps): StartedServer {
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

  const scheduleConfig: ScheduleConfig = { intervalMs };
  const server = createServer((req, res) => handle(req, res, { db, triggerNow, schedule: scheduleConfig }));
  const ready = new Promise<void>((resolveReady) => {
    server.listen(port, () => {
      process.stdout.write(`recruiting-exhibit listening on http://127.0.0.1:${port}\n`);
      resolveReady();
    });
  });

  return {
    stop: () => {
      clearInterval(schedule);
      server.close();
    },
    triggerNow,
    ready,
  };
}

interface HandleDeps {
  readonly db: SqliteDatabase;
  readonly triggerNow: () => Promise<RunResult>;
  readonly schedule: ScheduleConfig;
}

async function handle(req: IncomingMessage, res: ServerResponse, deps: HandleDeps): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  const method = req.method ?? 'GET';

  // Built frontend assets. Vite emits hashed files under
  // /assets/ and copies web/public/* to the static root.
  if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    serveStatic(res, 'index.html');
    return;
  }
  if (method === 'GET' && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/images/') || url.pathname === '/favicon.ico')) {
    serveStatic(res, url.pathname.replace(/^\/+/, ''));
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
    // Pass the real interval so `nextObservationAt` is computed
    // against the actual schedule — not a hidden default.
    return json(res, 200, readStatus(deps.db, deps.schedule));
  }
  if (method === 'GET' && url.pathname === '/api/inbox') {
    return json(res, 200, { entries: readInbox(deps.db) });
  }
  if (method === 'GET' && url.pathname === '/api/feed') {
    return json(res, 200, { entries: readFeed(deps.db) });
  }
  if (method === 'POST' && url.pathname === '/api/observation/run') {
    const result = await deps.triggerNow();
    // Audit fix #5: a second concurrent run is not silently
    // queued and not silently merged — it is rejected with 409
    // so the operator can see that the system is busy.
    if (result.status === 'skipped') {
      return json(res, 409, {
        error: result.errorMessage ?? 'another run is in progress',
      } satisfies JsonError);
    }
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

  // SPA fallback: every other GET route is a client-side route
  // (e.g. /meaning/:id, /radar) and is served the same shell.
  if (method === 'GET' && !url.pathname.startsWith('/api/')) {
    serveStatic(res, 'index.html');
    return;
  }

  json(res, 404, { error: 'not found' } satisfies JsonError);
}

function serveStatic(res: ServerResponse, name: string): void {
  // Resolve within STATIC_DIR and reject anything that escapes
  // it (path traversal). Subdirectories such as assets/ and
  // images/ are allowed — Vite emits hashed bundles there.
  const safeName = name.split('\\').join('/');
  const path = resolve(STATIC_DIR, safeName);
  const staticRoot = `${STATIC_DIR}${sep}`;
  if (path !== STATIC_DIR && !path.startsWith(staticRoot)) {
    json(res, 404, { error: 'not found' });
    return;
  }
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    // Missing index.html means the frontend has not been built.
    if (safeName === 'index.html') {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Frontend build missing. Run: npm run recruiting-exhibit:web');
      return;
    }
    json(res, 404, { error: 'not found' });
    return;
  }
  const ext = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : '';
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
