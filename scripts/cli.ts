import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { openDatabase, type SqliteDatabase } from '../storage/connection.js';
import { initSchema } from '../storage/init.js';
import {
  ingest,
  getById,
  list,
  type ListOptions,
} from '../evidence/repository/evidence-repository.js';
import { IngestPayloadSchema } from '../evidence/contracts/ingest.js';
import type { Market } from '../evidence/contracts/source-document.js';

// scripts/cli — `npm run cli -- <command> ...`
//
// P0001 §CLI: the minimum-viable human entry point for the
// Evidence layer. Three subcommands:
//   - evidence:add <path>   read JSON payload, ingest, print summary
//   - evidence:get <id>     print evidence + supporting sources
//   - evidence:list [...]   list evidence (optionally filtered)
//
// Not exposed to LLM / Agent / runtime. No business logic — every
// operation is a thin wrapper over `evidence-repository` and
// `storage`.

const DB_PATH_ENV = 'OPPORTUNITY_RADAR_DB';
const DEFAULT_DB_PATH = resolve(process.cwd(), 'data', 'dev.db');

const KNOWN_MARKETS: ReadonlySet<string> = new Set(['CN', 'US', 'GLOBAL', 'OTHER']);

function openProjectDb(): SqliteDatabase {
  const path = process.env[DB_PATH_ENV] ?? DEFAULT_DB_PATH;
  const db = openDatabase(path);
  initSchema(db);
  return db;
}

function help(): void {
  process.stdout.write(`Opportunity Radar CLI (P0001 — Evidence Foundation)

Usage:
  npm run cli -- evidence:add <path-to-json>
  npm run cli -- evidence:get <id>
  npm run cli -- evidence:list [--market <CN|US|GLOBAL|OTHER>] [--type <evidenceType>]

Environment:
  OPPORTUNITY_RADAR_DB — path to the SQLite file (default: data/dev.db)
`);
}

function printError(prefix: string, err: unknown): void {
  if (err instanceof ZodError) {
    process.stderr.write(`${prefix}: payload failed schema validation\n`);
    for (const issue of err.issues) {
      process.stderr.write(`  - ${issue.path.join('.')}: ${issue.message}\n`);
    }
    return;
  }
  if (err instanceof Error) {
    process.stderr.write(`${prefix}: ${err.message}\n`);
    return;
  }
  process.stderr.write(`${prefix}: ${String(err)}\n`);
}

function evidenceAdd(jsonPath: string): void {
  const db = openProjectDb();
  try {
    const abs = resolve(jsonPath);
    const raw = readFileSync(abs, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      printError('evidence:add', err);
      process.exit(1);
    }
    let payload;
    try {
      payload = IngestPayloadSchema.parse(parsed);
    } catch (err) {
      printError('evidence:add', err);
      process.exit(1);
    }
    const result = ingest(db, payload);
    process.stdout.write(`ingest ok\n`);
    process.stdout.write(`  source: ${result.sourceId} (new=${result.sourceIsNew})\n`);
    for (const e of result.evidence) {
      process.stdout.write(`  evidence: ${e.id} (new=${e.isNew}, corroborated=${e.corroborated})\n`);
    }
  } catch (err) {
    printError('evidence:add', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

function evidenceGet(id: string): void {
  const db = openProjectDb();
  try {
    const result = getById(db, id);
    if (result === null) {
      process.stderr.write(`evidence:get: not found: ${id}\n`);
      process.exit(1);
    }
    const e = result.evidence;
    process.stdout.write(`id:         ${e.id}\n`);
    process.stdout.write(`claim:      ${e.claim}\n`);
    process.stdout.write(`subject:    ${e.subject}\n`);
    process.stdout.write(`type:       ${e.evidenceType}\n`);
    process.stdout.write(`market:     ${e.market}\n`);
    process.stdout.write(`eventAt:    ${e.eventAt ?? '—'}\n`);
    process.stdout.write(`observedAt: ${e.observedAt}\n`);
    process.stdout.write(`confidence: ${e.confidence}\n`);
    process.stdout.write(`sources (${result.sources.length}):\n`);
    for (const s of result.sources) {
      process.stdout.write(`  - ${s.id} [${s.sourceType}] ${s.publisher} — "${s.title}"\n`);
      process.stdout.write(`    ${s.canonicalUrl}\n`);
    }
  } catch (err) {
    printError('evidence:get', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

function evidenceList(args: string[]): void {
  const options: ListOptions = {};
  for (let i = 0; i < args.length; i++) {
    const cur = args[i];
    if (cur === undefined) continue;
    if (cur === '--market') {
      const value = args[i + 1];
      if (value === undefined || !KNOWN_MARKETS.has(value)) {
        process.stderr.write(`evidence:list: --market requires one of CN|US|GLOBAL|OTHER\n`);
        process.exit(1);
      }
      options.market = value as Market;
      i++;
    } else if (cur === '--type') {
      const value = args[i + 1];
      if (value === undefined) {
        process.stderr.write(`evidence:list: --type requires a value\n`);
        process.exit(1);
      }
      options.evidenceType = value;
      i++;
    } else {
      process.stderr.write(`evidence:list: unknown argument: ${cur}\n`);
      process.exit(1);
    }
  }
  const db = openProjectDb();
  try {
    const items = list(db, options);
    if (items.length === 0) {
      process.stdout.write(`(no evidence match)\n`);
      return;
    }
    process.stdout.write(`${items.length} evidence\n`);
    for (const item of items) {
      const e = item.evidence;
      process.stdout.write(`\n${e.id}  [${e.evidenceType}]  market=${e.market}  sources=${item.sources.length}\n`);
      process.stdout.write(`  ${e.claim}\n`);
    }
  } catch (err) {
    printError('evidence:list', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    help();
    return;
  }
  const [command, first, ...rest] = args;
  if (command === 'help' || command === '--help' || command === '-h') {
    help();
    return;
  }
  if (command === 'evidence:add') {
    if (first === undefined) {
      process.stderr.write(`evidence:add: missing <path>\n`);
      process.exit(1);
    }
    evidenceAdd(first);
    return;
  }
  if (command === 'evidence:get') {
    if (first === undefined) {
      process.stderr.write(`evidence:get: missing <id>\n`);
      process.exit(1);
    }
    evidenceGet(first);
    return;
  }
  if (command === 'evidence:list') {
    evidenceList(first === undefined ? rest : [first, ...rest]);
    return;
  }
  process.stderr.write(`unknown command: ${args.join(' ')}\n`);
  help();
  process.exit(1);
}

main();
