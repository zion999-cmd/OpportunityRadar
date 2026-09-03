import { z } from 'zod';

// runtime/hermes/types.ts — Hermes-internal request / response shape.
//
// This module is the *only* place where Hermes's CLI / API surface
// is named. Everything outside `runtime/hermes/` imports from
// `runtime/index.js` (neutral) — never from here.
//
// The shapes here are what Hermes's `hermes -z` one-shot CLI (and,
// in a future revision, the `hermes serve` `/api/ws` session API)
// actually consume. They are not part of the Radar Domain contract.

export const hermesOneShotRequestSchema = z.object({
  /** Blind business prompt, plain text. Hermes does its own tool/MCP planning. */
  prompt: z.string().min(1),
  /**
   * Comma-separated toolset names. The MCP server resolves these
   * to the actual generic browser tools (`inspect_surface`,
   * `interact`, `inspect_network`, ...). Empty string = no tools.
   */
  toolsets: z.string().optional(),
  /** Hermes safe-mode flag. P0002 always runs with safeMode=true. */
  safeMode: z.boolean().default(true),
  /** Optional model override; agents normally let Hermes decide. */
  model: z.string().optional(),
  /** Optional provider override; agents normally let Hermes decide. */
  provider: z.string().optional(),
});
export type HermesOneShotRequest = z.infer<typeof hermesOneShotRequestSchema>;

export const hermesOneShotResultSchema = z.object({
  /** Raw stdout from the Hermes one-shot process. */
  stdout: z.string(),
  /** Process exit code. 0 = success; non-zero = adapter must throw. */
  exitCode: z.number().int(),
  /** Wall-clock duration of the Hermes invocation. */
  durationMs: z.number().nonnegative(),
});
export type HermesOneShotResult = z.infer<typeof hermesOneShotResultSchema>;

/**
 * The seam between the Hermes adapter and whatever concrete
 * Hermes transport we use (subprocess today, WebSocket session
 * tomorrow). The adapter holds one of these; the adapter's
 * `runtimeId` is fixed at `'hermes'` regardless of which
 * transport the seam wraps.
 */
export interface HermesClient {
  /** Run one Hermes turn synchronously and return its stdout. Throws on non-zero exit. */
  oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult>;
  /** Whether Hermes is currently available on this machine. Sync probe. */
  isAvailable(): boolean;
}

/** Thrown when Hermes is not installed / not on PATH / failed to spawn. */
export class HermesUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HermesUnavailableError';
  }
}
