// runtime/ — Agent-neutral Runtime seam. Public surface.
//
// The Domain (exploration/, evidence/, storage/) imports from
// `runtime/index.js` ONLY. Concrete adapters live under
// `runtime/hermes/`, `runtime/claude/` (future), etc. — they are
// implementation detail and must not be imported by the Domain.

export type { RuntimeAdapter, ExplorationRuntimeRouter } from './types.js';
export { DefaultExplorationRuntimeRouter } from './types.js';
