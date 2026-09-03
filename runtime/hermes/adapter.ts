import { explorationGoalSchema } from '../../exploration/contracts/exploration-goal.js';
import { explorationResultSchema, type ExplorationResult } from '../../exploration/contracts/exploration-result.js';
import type { RuntimeAdapter } from '../types.js';
import { buildHermesPrompt } from './prompt.js';
import { parseHermesOutput } from './parse.js';
import { HermesSubprocessClient } from './subprocess-client.js';
import { HermesStubClient } from './stub-client.js';
import type { HermesClient } from './types.js';

// runtime/hermes/adapter.ts — the Hermes concrete adapter.
//
// The adapter implements `RuntimeAdapter` (the Agent-neutral
// contract in `runtime/types.ts`). Everything Hermes-specific
// (prompt rendering, stdout parsing, CLI subprocess management)
// lives in this directory; the Radar Domain never imports
// anything from `./`. Per ADR-016 the dependency direction is
//
//   Domain → RuntimeAdapter  (in `runtime/types.ts`)
//            ← HermesRuntimeAdapter  (in `runtime/hermes/adapter.ts`)

export class HermesRuntimeAdapter implements RuntimeAdapter {
  readonly runtimeId = 'hermes';
  private readonly now: () => Date;

  constructor(
    private readonly client: HermesClient,
    options?: { now?: () => Date },
  ) {
    this.now = options?.now ?? ((): Date => new Date());
  }

  async execute(goalInput: unknown): Promise<ExplorationResult> {
    // The Domain hands us a typed ExplorationGoal, but the seam
    // is `execute(unknown)` so the bridge can pass either a Goal
    // or a JSON-shaped object. Re-validate at the adapter
    // boundary; failures become a thrown Error the bridge maps
    // to a `failed` run.
    const parsed = explorationGoalSchema.safeParse(goalInput);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const path = first?.path.join('.') ?? '<root>';
      throw new Error(
        `HermesRuntimeAdapter: invalid ExplorationGoal at ${path}: ${first?.message ?? 'unknown'}`,
      );
    }
    const goal = parsed.data;

    const prompt = buildHermesPrompt(goal);
    // P0002's exploration Goal is a public-web research question.
    // The Hermes one-shot toolset defaults vary by Hermes version;
    // to guarantee Hermes actually invokes the Web Search tool, the
    // adapter explicitly requests the `web` toolset. This is a
    // Hermes-internal transport concern; it lives in
    // `runtime/hermes/*` only and does not change the neutral
    // Domain or the `RuntimeAdapter` seam. Per ADR-016, switching
    // the underlying Hermes toolset is the adapter's problem, not
    // the Domain's.
    const oneShot = await this.client.oneShot({
      prompt,
      safeMode: true,
      toolsets: 'web',
    });
    const result = parseHermesOutput(oneShot.stdout, goal.id, this.now);

    // Belt-and-braces: the parser already returns a Zod-valid
    // Result, but re-parse so a future contract change fails
    // loudly here rather than silently writing garbage.
    return explorationResultSchema.parse(result);
  }
}

/**
 * Build the default Hermes adapter.
 *
 * Selection logic (priority order):
 *   1. `HERMES_CLIENT=stub` (env)        → HermesStubClient
 *   2. `NODE_ENV=test` or `VITEST=true`  → HermesStubClient
 *   3. otherwise                          → HermesSubprocessClient
 *
 * Override programmatically by passing a `client` to the
 * constructor. Tests use the stub; live acceptance uses the
 * subprocess.
 */
export function createHermesAdapter(options?: {
  client?: HermesClient;
  now?: () => Date;
}): RuntimeAdapter {
  const client = options?.client ?? defaultHermesClient();
  return new HermesRuntimeAdapter(client, options !== undefined ? { now: options.now } : {});
}

function defaultHermesClient(): HermesClient {
  const env = process.env['HERMES_CLIENT'];
  const isTest = process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true';
  if (env === 'stub' || isTest) return new HermesStubClient();
  return new HermesSubprocessClient();
}
