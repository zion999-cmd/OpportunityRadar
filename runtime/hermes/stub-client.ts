import type { HermesOneShotRequest, HermesOneShotResult } from './types.js';
import type { HermesClient } from './types.js';

// runtime/hermes/stub-client.ts — deterministic Hermes stand-in
// for tests and for "no Hermes on this box" dev mode.
//
// The stub returns a parseable JSON line so the adapter can be
// exercised end-to-end without invoking the real Hermes binary.
// Tests inject a stub; production never does.

export class HermesStubClient implements HermesClient {
  isAvailable(): boolean {
    return true;
  }

  async oneShot(req: HermesOneShotRequest): Promise<HermesOneShotResult> {
    // The stub echoes a minimal valid JSON payload. Callers can
    // customize via the static `setNext(...)` hook in tests.
    const payload = HermesStubClient.nextPayload ?? {
      summary: 'stub: no Hermes invoked',
      sources: [],
      evidenceCandidates: [],
    };
    const stdout =
      `stub-hermes: blind prompt was (first 80 chars): ${req.prompt.slice(0, 80)}\n` +
      JSON.stringify(payload);
    return { stdout, exitCode: 0, durationMs: 1 };
  }

  private static nextPayload: unknown = null;
  /** Test-only: pre-program the next stub response. */
  static setNext(payload: unknown): void {
    HermesStubClient.nextPayload = payload;
  }
  /** Test-only: reset to default empty payload. */
  static reset(): void {
    HermesStubClient.nextPayload = null;
  }
}
