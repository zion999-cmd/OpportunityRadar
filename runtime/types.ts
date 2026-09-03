import type { ExplorationGoal } from '../exploration/contracts/exploration-goal.js';
import type { ExplorationResult } from '../exploration/contracts/exploration-result.js';

// Agent-neutral runtime seam — P0002 §"Thin Adapter Boundary".
//
// This module is the *only* place where the Radar Domain touches
// the concept of an "external Agent Runtime". The seam is two
// interfaces and one router — no registry, no capability metadata,
// no execution-plan scaffolding, no policy constraints, no
// streaming, no session model. Each concrete Runtime implements
// `RuntimeAdapter` and is injected into the bridge. Switching
// runtimes is a composition-root decision, not a domain decision.
//
// The contracts reference Radar's own Zod types directly. This is
// intentional: the seam is "Goal in, Result out" — both shapes are
// defined and validated by the Radar Domain. The adapter's job is
// to translate between Radar's neutral shapes and whatever the
// concrete Runtime actually speaks. Translation, not invention.

/**
 * The contract every concrete Agent Runtime adapter must implement.
 *
 * The adapter is allowed to know whatever specific transport,
 * session, model, or tool the underlying Runtime requires. The
 * Radar Domain is NOT. Per ADR-016, dependency direction is
 *
 *   Domain → RuntimeAdapter (this interface)
 *            ← concrete Adapter (knows Runtime internals)
 *
 * Switching adapters never requires touching the Domain.
 */
export interface RuntimeAdapter {
  /** Stable id used in logs and run records. Never null. */
  readonly runtimeId: string;

  /**
   * Dispatch an ExplorationGoal to the concrete Agent Runtime and
   * return a Zod-validatable ExplorationResult. Adapters MAY throw
   * if the Runtime is unavailable; the bridge translates that into
   * a `failed` run record with the error message preserved.
   *
   * Adapters MUST treat the Goal as untrusted (Zod-validate) and
   * MUST return a Result that round-trips through
   * `explorationResultSchema`. Adapters MUST NOT silently drop
   * candidates the Goal asked for; if the Runtime returned
   * nothing, the Result's `evidenceCandidates` is `[]`.
   */
  execute(goal: ExplorationGoal): Promise<ExplorationResult>;
}

/**
 * The single Control-Plane entry point the Domain depends on.
 *
 * Today this is a one-line dispatch to a single injected adapter.
 * The interface exists so that the Domain never imports
 * `RuntimeAdapter` directly: when (not if) a second Runtime
 * appears, the only thing that changes is the router's
 * implementation. The Domain, bridge, and contracts stay frozen.
 */
export interface ExplorationRuntimeRouter {
  dispatch(goal: ExplorationGoal): Promise<ExplorationResult>;
}

/**
 * The default router. Holds a single adapter. Dispatches 1:1.
 *
 * `routerPreference` is accepted but ignored: with one adapter
 * there is nothing to choose. The field is kept on the signature
 * so the call sites do not change when a second adapter lands.
 */
export class DefaultExplorationRuntimeRouter implements ExplorationRuntimeRouter {
  constructor(private readonly adapter: RuntimeAdapter) {}

  async dispatch(goal: ExplorationGoal, _routerPreference?: string): Promise<ExplorationResult> {
    return this.adapter.execute(goal);
  }
}
