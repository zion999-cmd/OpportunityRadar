// scripts/recruiting-exhibit-cli — `npm run recruiting-exhibit`.
//
// Boots the recruiting-exhibit HTTP server, the hourly
// observation scheduler, and (optionally) a one-shot manual
// observation run before the server starts.
//
// Flags (env vars, to keep argv parsing out of the script):
//   PORT=NNNN                 — HTTP port (default: 4173)
//   RECRUITING_EXHIBIT_ONCE=1 — run a single observation pass
//                              before the server starts
//   RECRUITING_EXHIBIT_STUB=1 — use the HermesStubClient
//                              (no model calls)
//   OPPORTUNITY_RADAR_DB      — sqlite path (default: data/dev.db)

import { resolve } from 'node:path';
import { openExhibitDatabase } from '../apps/recruiting-exhibit/db.js';
import { runObservation } from '../apps/recruiting-exhibit/observation.js';
import { startServer } from '../apps/recruiting-exhibit/server.js';
import { HermesStubClient } from '../runtime/hermes/stub-client.js';
import { HermesSubprocessClient } from '../runtime/hermes/subprocess-client.js';
import type { HermesClient } from '../runtime/hermes/types.js';

const DEFAULT_PORT = 4173;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_DB_PATH = resolve(process.cwd(), 'data', 'dev.db');

async function main(): Promise<void> {
  const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
  const dbPath = process.env['OPPORTUNITY_RADAR_DB'] ?? DEFAULT_DB_PATH;
  const intervalMs = Number(process.env['RECRUITING_EXHIBIT_INTERVAL_MS'] ?? DEFAULT_INTERVAL_MS);
  const stub = process.env['RECRUITING_EXHIBIT_STUB'] === '1';
  const runOnce = process.env['RECRUITING_EXHIBIT_ONCE'] === '1';

  const client: HermesClient = stub ? new HermesStubClient() : new HermesSubprocessClient();
  if (!stub && !client.isAvailable()) {
    process.stderr.write('recruiting-exhibit: Hermes is not available on this machine; set RECRUITING_EXHIBIT_STUB=1 to run without model calls.\n');
    process.exit(1);
  }
  const db = openExhibitDatabase(dbPath);
  const now = (): Date => new Date();

  if (runOnce) {
    process.stdout.write('recruiting-exhibit: running a one-shot observation before starting the server…\n');
    const result = await runObservation({ db, client, now }, 'manual');
    process.stdout.write(`recruiting-exhibit: one-shot run ${result.status} (new_evidence=${result.newEvidenceCount}, new_relationship=${result.newRelationshipCount})\n`);
  }

  startServer({ db, client, port, now, intervalMs });
}

main().catch((err) => {
  process.stderr.write(`recruiting-exhibit: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
