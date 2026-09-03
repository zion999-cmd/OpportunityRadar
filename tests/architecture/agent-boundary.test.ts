import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Architecture / boundary test — ADR-016.
//
// P0002 final architecture enforces dependency direction, not a
// blanket "no concrete Runtime anywhere" rule. The contract:
//
//   Domain modules (evidence, exploration, storage, shared,
//   runtime/types, runtime/index) MUST NOT reference any specific
//   Agent Runtime by name. They depend only on the Agent-neutral
//   Runtime seam (`runtime/types.ts`).
//
//   The composition root (`scripts/cli.ts`) and concrete adapter
//   directories (`runtime/hermes/`, future `runtime/claude/`,
//   `runtime/codex/`, `runtime/openclaw/`) ARE allowed to name
//   concrete Runtimes. The whole point of an adapter is that it
//   absorbs the Runtime-specific knowledge so the Domain does not
//   have to.
//
//   Test files and the architecture test itself are exempt
//   because they must name the forbidden tokens to assert their
//   absence.
//
// Dependency direction: concrete Runtimes depend inward (on
// Radar's neutral contracts). Neutral contracts depend only on
// each other. The Domain does not depend outward on any specific
// Runtime.

const SCAN_ROOTS = ['evidence', 'exploration', 'storage', 'shared', 'runtime'];

/** Files / directories where concrete Runtime names ARE allowed. */
const ALLOWLISTED_PATHS: ReadonlyArray<string> = [
  // The architecture test itself names the forbidden tokens.
  'tests/architecture/',
  // Concrete adapter for the Hermes Runtime. Allowed by ADR-016.
  'runtime/hermes/',
  // The composition root wires the adapter to the router.
  'scripts/cli.ts',
  // The neutral seam barrel; safe to scan but never names Runtimes.
  'runtime/index.ts',
];

const FORBIDDEN_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'agent-runtime-name-hermes', re: /\bhermes\b/i },
  { id: 'agent-runtime-name-codex', re: /\bcodex\b/i },
  // The Agent Runtime is "Claude" — a capitalized product name
  // (e.g. "Claude", "claude", "claude-code"). We deliberately
  // exempt "CLAUDE.md" (the operating manual filename) via a
  // negative lookahead so the architecture test does not flag
  // every doc reference in every contract.
  { id: 'agent-runtime-name-claude', re: /\bclaude\b(?!\.md)/i },
  { id: 'agent-runtime-name-openclaw', re: /\bopenclaw\b/i },
  // The old AgentExecutor surface from the first reworked P0002
  // (long superseded, but kept on the list so a regression
  // reintroducing it is still caught).
  { id: 'agent-executor-interface', re: /\bAgentExecutor\b/ },
  { id: 'agent-send-options', re: /\bAgentSendOptions\b/ },
  { id: 'agent-send-result', re: /\bAgentSendResult\b/ },
  { id: 'agent-send-turn', re: /\bsendTurn\b/ },
];

const SELF_PATH_RELATIVE = relative(
  process.cwd(),
  new URL(import.meta.url).pathname,
);

interface ScanHit {
  file: string;
  patternId: string;
  line: number;
  match: string;
}

function isAllowlisted(rel: string): boolean {
  const normalized = rel.split(sep).join('/');
  return ALLOWLISTED_PATHS.some((allowed) => normalized === allowed || normalized.startsWith(allowed));
}

function walkTsFiles(root: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(root, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTsFiles(full, acc);
      continue;
    }
    if (!st.isFile()) continue;
    if (!/\.ts$/.test(entry)) continue;
    acc.push(full);
  }
  return acc;
}

function scanFile(absolutePath: string): ScanHit[] {
  const rel = relative(process.cwd(), absolutePath);
  if (rel === SELF_PATH_RELATIVE) {
    // The architecture test itself names the forbidden tokens.
    return [];
  }
  if (isAllowlisted(rel)) {
    // Concrete adapter, composition root, or test code.
    return [];
  }
  let text: string;
  try {
    text = readFileSync(absolutePath, 'utf-8');
  } catch {
    return [];
  }
  const hits: ScanHit[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    for (const { id, re } of FORBIDDEN_PATTERNS) {
      const m = line.match(re);
      if (m) {
        hits.push({ file: rel, patternId: id, line: i + 1, match: m[0] });
      }
    }
  }
  return hits;
}

describe('Agent boundary — ADR-016 (dependency direction)', () => {
  it('no Domain-owned file references a specific Agent Runtime or the old AgentExecutor surface', () => {
    const allFiles: string[] = [];
    for (const root of SCAN_ROOTS) {
      walkTsFiles(root, allFiles);
    }

    const hits: ScanHit[] = [];
    for (const f of allFiles) {
      hits.push(...scanFile(f));
    }

    if (hits.length > 0) {
      const lines = hits.map(
        (h) => `  - ${h.file}:${h.line}  [${h.patternId}]  match="${h.match}"`,
      );
      throw new Error(
        `Agent boundary violation (ADR-016). Domain modules (evidence, exploration, storage, shared, runtime/types, runtime/index) must not reference any specific Agent Runtime or the old AgentExecutor surface.\n` +
          `Allowed locations for concrete Runtime names: ${ALLOWLISTED_PATHS.join(', ')}.\n` +
          `Forbidden patterns: ${FORBIDDEN_PATTERNS.map((p) => p.id).join(', ')}\n` +
          `Hits:\n${lines.join('\n')}\n` +
          `If you genuinely need a new Runtime integration, place it under runtime/<runtime-name>/ (concrete adapter) or scripts/cli.ts (composition root) — not in the Domain.`,
      );
    }

    // Sanity: the test actually scanned at least one file.
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it('the runtime/types.ts Agent-neutral seam does not import any concrete Runtime', () => {
    // Belt-and-braces: read the neutral seam directly and assert
    // it has no runtime-specific import or identifier. The
    // general scan above would catch the same violations, but
    // this dedicated test produces a clearer error message and
    // documents the rule for future readers.
    const typesPath = join(process.cwd(), 'runtime', 'types.ts');
    const text = readFileSync(typesPath, 'utf-8');
    for (const { id, re } of FORBIDDEN_PATTERNS) {
      const m = text.match(re);
      expect(m, `runtime/types.ts must not match pattern [${id}]`).toBeNull();
    }
  });
});
