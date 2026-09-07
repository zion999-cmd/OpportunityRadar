import {
  caseA,
  caseB,
  caseC,
  caseD,
  allCases,
  type MatchingCase,
} from '../matching/cases.js';
import {
  probe1,
  probe2,
  probe3,
  probe4,
  probe5,
  probe6,
  probe7,
  probe8,
  allProbes,
} from '../matching/probes.js';
import { runCase } from '../matching/run.js';

// scripts/matching-cli — POC entry point.
//
// Usage:
//   npm run matching-cli -- --case <A|B|C|D|1|2|3|4|5|6|7|8|cases|probes|all>
//
//   A / B / C / D   — one of the original 4 Ground Truth cases
//   1 .. 8          — one of the 8 semantic probes
//   cases           — all 4 original cases
//   probes          — all 8 semantic probes
//   all             — all 12 (4 cases + 8 probes)
//
// Each invocation runs the chosen input(s) through real Hermes
// and writes one Markdown artifact per case under
// `artifacts/matching/`. No DB, no ingest, no P0001/P0002.

const PROBES: ReadonlyArray<MatchingCase> = allProbes;

function parseArgs(): { cases: ReadonlyArray<MatchingCase> } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--case');
  if (idx < 0 || args[idx + 1] === undefined) {
    process.stderr.write(
      'usage: matching-cli --case <A|B|C|D|1..8|cases|probes|all>\n',
    );
    process.exit(1);
  }
  const value = args[idx + 1]!;
  switch (value) {
    case 'A': return { cases: [caseA] };
    case 'B': return { cases: [caseB] };
    case 'C': return { cases: [caseC] };
    case 'D': return { cases: [caseD] };
    case '1': return { cases: [PROBES[0]!] };
    case '2': return { cases: [PROBES[1]!] };
    case '3': return { cases: [PROBES[2]!] };
    case '4': return { cases: [PROBES[3]!] };
    case '5': return { cases: [PROBES[4]!] };
    case '6': return { cases: [PROBES[5]!] };
    case '7': return { cases: [PROBES[6]!] };
    case '8': return { cases: [PROBES[7]!] };
    case 'cases': return { cases: allCases };
    case 'probes': return { cases: PROBES };
    case 'all': return { cases: [...allCases, ...PROBES] };
    default:
      process.stderr.write(`matching-cli: unknown --case value: ${value}\n`);
      process.exit(1);
  }
}

async function main(): Promise<void> {
  const { cases } = parseArgs();
  for (const c of cases) {
    process.stdout.write(`\nmatching: case=${c.id} (${c.label})\n`);
    const outcome = await runCase(c);
    process.stdout.write(`matching: status=${outcome.status}\n`);
    process.stdout.write(`matching: durationMs=${outcome.durationMs}\n`);
    if (outcome.judgment !== null) {
      process.stdout.write(`matching: kind=${outcome.judgment.judgment}\n`);
    }
    if (outcome.errorMessage !== null) {
      process.stdout.write(`matching: errorMessage=${outcome.errorMessage}\n`);
    }
    process.stdout.write(`matching: artifact=${outcome.artifactPath}\n`);
    if (outcome.status === 'failed') {
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  process.stderr.write(`matching-cli: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
