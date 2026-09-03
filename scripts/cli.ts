import { randomUUID } from 'node:crypto';
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
import { createExplorationBridge } from '../exploration/bridge/exploration-bridge.js';
import { createSqliteRunRecorder } from '../exploration/repository/exploration-run-repository.js';
import { explorationGoalSchema, type ExplorationGoal } from '../exploration/contracts/exploration-goal.js';
import { DefaultExplorationRuntimeRouter } from '../runtime/types.js';
import { createHermesAdapter } from '../runtime/hermes/index.js';

// scripts/cli — `npm run cli -- <command> ...`
//
// P0001 + P0002 final architecture (P0002 §"Active Dispatch").
//
// P0001 subcommands (Evidence layer):
//   - evidence:add <path>            read JSON payload, ingest, print summary
//   - evidence:get <id>              print evidence + supporting sources
//   - evidence:list [...]            list evidence (optionally filtered)
//
// P0002 subcommand (Exploration layer):
//   - explore --market <CN|US|GLOBAL|OTHER> --question "..."
//                                     the operator types a business
//                                     question; Radar constructs an
//                                     ExplorationGoal, the bridge
//                                     actively dispatches it through
//                                     the Agent-neutral Runtime seam
//                                     to the Hermes adapter, the
//                                     adapter calls Hermes, Hermes
//                                     returns an ExplorationResult,
//                                     the bridge Zod-validates it,
//                                     applies the provenance gate,
//                                     and ingests accepted candidates
//                                     into P0001. The user does not
//                                     see Hermes; they do not see a
//                                     prompt file or a result file;
//                                     they see one CLI invocation
//                                     and a printed run summary.
//
// The composition root (this file) is the single place that wires
// the Agent-neutral Router to a concrete Hermes adapter. P0002's
// forbidden-token architecture test does NOT scan this file (the
// CLI is allowed to import runtime-specific modules because it is
// the composition root, not the domain). The domain modules
// (`exploration/`, `evidence/`, `storage/`, `shared/`) are still
// Agent-neutral.

const DB_PATH_ENV = 'OPPORTUNITY_RADAR_DB';
const DEFAULT_DB_PATH = ((): string => {
  const cwd = process.cwd();
  return `${cwd}/data/dev.db`;
})();

const KNOWN_MARKETS: ReadonlySet<string> = new Set(['CN', 'US', 'GLOBAL', 'OTHER']);

function openProjectDb(): SqliteDatabase {
  const path = process.env[DB_PATH_ENV] ?? DEFAULT_DB_PATH;
  const db = openDatabase(path);
  initSchema(db);
  return db;
}

function help(): void {
  process.stdout.write(`Opportunity Radar CLI (P0001 + P0002)

Usage:
  npm run cli -- evidence:add <path-to-json>
  npm run cli -- evidence:get <id>
  npm run cli -- evidence:list [--market <CN|US|GLOBAL|OTHER>] [--type <evidenceType>]
  npm run cli -- explore --market <CN|US|GLOBAL|OTHER> --question "<business question>"
              [--time-window "<text>"] [--evidence-interest <type>]...

Environment:
  OPPORTUNITY_RADAR_DB  — path to the SQLite file (default: data/dev.db)

P0002 — the explore subcommand is the operator's primary entry
point for the exploration loop. Radar constructs an
ExplorationGoal from the CLI arguments, dispatches it through
the Agent-neutral Runtime seam (a Hermes adapter), and ingests
the accepted Evidence candidates into P0001. The user does not
need to know which Agent Runtime was used; the run record
records the runtimeId for traceability. See ADR-016.
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
    const payload = IngestPayloadSchema.parse(parsed);
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

// ===== P0002 explore subcommand =====
//
// Operator types a business question. Radar constructs an
// ExplorationGoal, the bridge dispatches it through the
// Agent-neutral Router to the Hermes adapter, and accepted
// candidates land in P0001. The CLI prints a one-shot summary
// of the run.

interface ExploreArgs {
  market: Market;
  question: string;
  timeWindow: string | null;
  evidenceInterests: string[];
}

function parseExploreArgs(args: string[]): ExploreArgs {
  let market: string | undefined;
  let question: string | undefined;
  let timeWindow: string | null = null;
  const evidenceInterests: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const cur = args[i];
    if (cur === undefined) continue;
    if (cur === '--market') {
      const value = args[i + 1];
      if (value === undefined) {
        process.stderr.write('explore: --market requires a value\n');
        process.exit(1);
      }
      if (!KNOWN_MARKETS.has(value)) {
        process.stderr.write(`explore: --market must be one of CN|US|GLOBAL|OTHER\n`);
        process.exit(1);
      }
      market = value;
      i += 1;
    } else if (cur === '--question') {
      const value = args[i + 1];
      if (value === undefined) {
        process.stderr.write('explore: --question requires a value\n');
        process.exit(1);
      }
      question = value;
      i += 1;
    } else if (cur === '--time-window') {
      const value = args[i + 1];
      if (value === undefined) {
        process.stderr.write('explore: --time-window requires a value\n');
        process.exit(1);
      }
      timeWindow = value;
      i += 1;
    } else if (cur === '--evidence-interest') {
      const value = args[i + 1];
      if (value === undefined) {
        process.stderr.write('explore: --evidence-interest requires a value\n');
        process.exit(1);
      }
      evidenceInterests.push(value);
      i += 1;
    } else if (cur === '--help' || cur === '-h') {
      process.stdout.write(`explore — actively dispatch a business question through the Agent-neutral Runtime seam.

  --market <CN|US|GLOBAL|OTHER>    (required) the market the question is about
  --question "<text>"              (required) the business question
  --time-window "<text>"           (optional) time-window hint for the Agent
  --evidence-interest <type>       (optional, repeatable) hint the Agent toward
                                    specific evidence types (funding, valuation,
                                    customer_adoption, etc.)

The user does not need to know which Agent Runtime is used; the
Runtime is wired at this composition root. The run record
records the runtimeId for traceability. See ADR-016.
`);
      process.exit(0);
    } else {
      process.stderr.write(`explore: unknown argument: ${cur}\n`);
      process.exit(1);
    }
  }
  if (market === undefined) {
    process.stderr.write('explore: --market is required\n');
    process.exit(1);
  }
  if (question === undefined) {
    process.stderr.write('explore: --question is required\n');
    process.exit(1);
  }
  return { market: market as Market, question, timeWindow, evidenceInterests };
}

async function explore(args: string[]): Promise<void> {
  const parsed = parseExploreArgs(args);
  const goal: ExplorationGoal = explorationGoalSchema.parse({
    id: `goal-${randomUUID()}`,
    question: parsed.question,
    market: parsed.market,
    ...(parsed.timeWindow !== null ? { timeWindow: parsed.timeWindow } : {}),
    ...(parsed.evidenceInterests.length > 0
      ? { evidenceInterests: parsed.evidenceInterests as ExplorationGoal['evidenceInterests'] }
      : {}),
    createdAt: new Date().toISOString(),
  });

  process.stdout.write(`explore: goalId=${goal.id}\n`);
  process.stdout.write(`explore: market=${goal.market}\n`);
  process.stdout.write(`explore: question="${goal.question}"\n`);

  const db = openProjectDb();
  try {
    // Composition root: wire Hermes adapter (concrete) into the
    // Agent-neutral Router (neutral). The bridge depends only on
    // the Router. The CLI is the single place that knows both.
    const adapter = createHermesAdapter();
    const router = new DefaultExplorationRuntimeRouter(adapter);
    const recorder = createSqliteRunRecorder(db);
    const bridge = createExplorationBridge({
      db,
      router,
      runtimeId: adapter.runtimeId,
      evidenceIngest: ingest,
      runRecorder: recorder,
    });
    process.stdout.write(`explore: dispatching through runtimeId=${adapter.runtimeId} ...\n`);
    const outcome = await bridge.run(goal);
    process.stdout.write(`\nexplore: runId=${outcome.runId}\n`);
    process.stdout.write(`explore: status=${outcome.status}\n`);
    process.stdout.write(`explore: runtimeId=${outcome.runtimeId}\n`);
    process.stdout.write(`explore: accepted=${outcome.accepted} rejected=${outcome.rejected}\n`);
    if (outcome.errorMessage !== null) {
      process.stdout.write(`explore: errorMessage=${outcome.errorMessage}\n`);
    }
    if (outcome.result !== null) {
      const r = outcome.result;
      process.stdout.write(`explore: summary="${r.summary}"\n`);
      process.stdout.write(`explore: candidates=${r.evidenceCandidates.length} sources=${r.sources.length}\n`);
    }
    if (outcome.status === 'failed') {
      process.exit(1);
    }
  } catch (err) {
    printError('explore', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
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
  if (command === 'explore') {
    await explore(first === undefined ? rest : [first, ...rest]);
    return;
  }
  process.stderr.write(`unknown command: ${args.join(' ')}\n`);
  help();
  process.exit(1);
}

main().catch((err) => {
  printError('cli', err);
  process.exit(1);
});
