import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HermesUnavailableError, type HermesClient } from './types.js';
import type { HermesOneShotRequest, HermesOneShotResult } from './types.js';

// runtime/hermes/subprocess-client.ts — invokes Hermes in one-shot mode.
//
// ADAPTER IMPLEMENTATION CHOICE (not the final Hermes architecture):
//   We use a small in-tree Python runner (`oneshot-runner.py`) instead
//   of the bare `hermes -z` CLI. The reason: Hermes's plain CLI entry
//   point does not eagerly trigger plugin discovery, so a freshly
//   installed web provider (e.g. the bundled `web/ddgs` plugin) is
//   invisible to the one-shot process. The runner forces plugin
//   discovery in-process before invoking `hermes_cli.oneshot.run_oneshot`
//   so the web provider registry is populated when the AIAgent
//   resolves the `web` toolset.
//
//   This is a Hermes-internal startup quirk; the fix lives in
//   `runtime/hermes/*` and does not change the Radar Domain or the
//   neutral `RuntimeAdapter` seam. Per ADR-016, this is the adapter's
//   problem.
//
//   If future continuous-exploration pressure requires a persistent
//   Hermes process, a long-lived session, or a /api/ws transport,
//   that change MUST stay inside runtime/hermes/* — the Domain and
//   the neutral RuntimeAdapter seam must not be touched. The neutral
//   seam is "execute(goal) → Result"; how the adapter arranges that
//   underneath is the adapter's problem.
//
// Per ADR-016 ("Thin Adapter Boundary"), the CLI flag surface lives
// here and ONLY here. The Domain sees a HermesClient interface; the
// adapter sees the actual Hermes invocation.

const HERMES_BIN = process.env['HERMES_BIN'] ?? 'hermes';
const HERMES_HOME = process.env['HERMES_HOME'] ?? `${process.env['HOME'] ?? ''}/.hermes`;
// The Hermes venv Python carries `hermes_cli` and its full
// dependency closure (httpx, dotenv, ddgs, ...). Using the system
// `python3` here would fail with `No module named 'dotenv'` for
// every invocation. We default to the venv Python and let the
// caller override via `HERMES_PYTHON` for custom deployments.
const HERMES_PYTHON = process.env['HERMES_PYTHON']
  ?? `${HERMES_HOME}/hermes-agent/venv/bin/python3`;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 min; a real web query can take a while.
const VERSION_PROBE_TIMEOUT_MS = 5_000;

// Resolve the absolute path of the oneshot runner that lives next to
// this file. tsx compiles `.ts` files to a temp dir, so we resolve
// relative to `import.meta.url` (which is the compiled `.js` URL at
// runtime and the source `.ts` URL under tsx).
const ONESHOT_RUNNER_PATH = ((): string => {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, 'oneshot-runner.py');
})();

/**
 * Build the argv for the in-tree Hermes one-shot runner.
 *
 * The runner exposes a CLI surface that mirrors `hermes -z`:
 *   --prompt        (required)
 *   --hermes-home   (default: $HERMES_HOME or ~/.hermes)
 *   --model         (optional)
 *   --provider      (optional)
 *   --toolsets      (optional, e.g. 'web')
 *   --safe-mode / --no-safe-mode  (default: --safe-mode)
 *
 * The runner forces Hermes plugin discovery before invoking
 * `hermes_cli.oneshot.run_oneshot`, so the web provider registry is
 * populated when the AIAgent resolves the `web` toolset.
 */
const buildArgs = (req: HermesOneShotRequest): string[] => {
  const args: string[] = [
    ONESHOT_RUNNER_PATH,
    '--hermes-home', HERMES_HOME,
    '--prompt', req.prompt,
  ];
  if (req.model !== undefined) args.push('--model', req.model);
  if (req.provider !== undefined) args.push('--provider', req.provider);
  if (req.toolsets !== undefined && req.toolsets.length > 0) {
    args.push('--toolsets', req.toolsets);
  }
  // Default to safe mode; only the in-tree runner and the seam
  // control this. P0002 always runs with safeMode=true.
  if (req.safeMode) {
    args.push('--safe-mode');
  } else {
    args.push('--no-safe-mode');
  }
  return args;
};

export class HermesSubprocessClient implements HermesClient {
  private readonly timeoutMs: number;
  private readonly pythonBin: string;

  constructor(opts: { timeoutMs?: number; pythonBin?: string } = {}) {
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.pythonBin = opts.pythonBin ?? HERMES_PYTHON;
  }

  isAvailable(): boolean {
    // Quick synchronous probe: `hermes --version` exits 0 if the
    // binary is on PATH and runnable. If the binary is missing,
    // `spawnSync` throws ENOENT — caught and turned into `false`.
    try {
      const res = spawnSync(HERMES_BIN, ['--version'], { timeout: VERSION_PROBE_TIMEOUT_MS });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  async oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult> {
    const args = buildArgs(req);
    const start = Date.now();

    return new Promise<HermesOneShotResult>((resolve, reject) => {
      const child = spawn(this.pythonBin, args, { timeout: this.timeoutMs });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', (err: Error) => {
        reject(
          new HermesUnavailableError(
            `failed to spawn ${this.pythonBin} ${args[0]}: ${err.message}. Is Python3 on PATH and is the in-tree runner present?`,
          ),
        );
      });
      child.on('close', (code: number | null) => {
        const durationMs = Date.now() - start;
        if (code !== 0) {
          reject(
            new HermesUnavailableError(
              `hermes oneshot-runner exited with code ${code}. stderr: ${stderr.slice(0, 500)}`,
            ),
          );
          return;
        }
        resolve({ stdout: stdout.trimEnd(), exitCode: code ?? 0, durationMs });
      });
    });
  }
}
