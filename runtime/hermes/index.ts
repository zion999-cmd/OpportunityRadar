// runtime/hermes/ — Hermes concrete adapter (the first Runtime
// implementation for P0002). Public surface for composition roots
// (CLI main, future deployment wiring). The Domain never imports
// from here; the bridge receives a `RuntimeAdapter` already wired.

export type { HermesClient, HermesOneShotRequest, HermesOneShotResult } from './types.js';
export { HermesUnavailableError } from './types.js';
export { HermesSubprocessClient } from './subprocess-client.js';
export { HermesStubClient } from './stub-client.js';
export { HermesRuntimeAdapter, createHermesAdapter } from './adapter.js';
export { buildHermesPrompt } from './prompt.js';
export { parseHermesOutput, extractJsonObject } from './parse.js';
