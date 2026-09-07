import type { HermesClient } from '../../../runtime/hermes/types.js';
import { buildSessionPrompt, buildForcedSurfacePrompt } from './prompt.js';
import {
  parseRuntimeDecision,
  parseForcedSurfaceDecision,
  type AskDecision,
  type SurfaceDecision,
  type RuntimeDecision,
} from './parse.js';
import {
  appendIntentEvidence,
  createInitialState,
  incrementAskCount,
  isBudgetExhausted,
  MAX_ASK_BUDGET,
  type SessionState,
} from './state.js';
import { snapshotFromTimeline, type SessionSnapshot } from './snapshot.js';
// matching/recruiting-poc/session/runtime.ts —
// the minimal session runtime for the Product Spine.
//
// One class, `Session`, with one method, `step`:
//
//   - constructor(initialSituation, hermesClient)
//   - step(userAnswer?) — runs one runtime turn.
//
// Each turn:
//   1. If userAnswer is provided, append it to the
//      rawIntentEvidence timeline.
//   2. If the ask budget is exhausted, use the
//      forced-surface prompt + parser. Otherwise, use the
//      decision prompt + parser.
//   3. Call the HermesClient.oneShot.
//   4. Parse the response.
//   5. If the decision is `ask`, increment askCount and
//      record the question.
//   6. Return the decision + updated state + raw output.
//
// The session is a thin loop. It does not maintain
// domain meaning (no Job, no profile, no requirements,
// no tags). It only maintains the session state
// (rawSituation, rawIntentEvidence, askCount) and the
// timeline of decisions.
//
// The HermesClient is injected so tests can use a
// deterministic stub. Production wires the real
// HermesSubprocessClient.

export interface SessionTurn {
  readonly turnIndex: number;
  readonly decision: RuntimeDecision;
  readonly stateAfter: SessionState;
  readonly prompt: string;
  readonly rawOutput: string;
  readonly durationMs: number;
  readonly forced: boolean;
}

/**
 * A turn that produced a model invocation but failed to parse
 * the response. The minimum persisted record is
 * `{ rawOutput, error, forced, stateBefore }` plus
 * `turnIndex` for ordering with the successful turns.
 *
 * The model invocation is a real fact about the session: the
 * session must never erase it. A failed turn is NOT pushed to
 * `turns`; it is recorded in its own `failedTurns` array so
 * the timeline of successful decisions stays clean.
 */
export interface FailedTurn {
  readonly turnIndex: number;
  readonly rawOutput: string;
  readonly error: string;
  readonly forced: boolean;
  readonly stateBefore: SessionState;
}

/**
 * Thrown by `Session.step()` when the hermes response cannot
 * be parsed into a valid `RuntimeDecision`. Carries the
 * `FailedTurn` record so the caller can persist it before the
 * process exits.
 */
export class SessionParseError extends Error {
  public readonly failedTurn: FailedTurn;
  constructor(failedTurn: FailedTurn) {
    super(
      `SessionParseError: turn ${failedTurn.turnIndex} parse failed: ${failedTurn.error}`,
    );
    this.name = 'SessionParseError';
    this.failedTurn = failedTurn;
  }
}

export interface SessionTimeline {
  readonly initialSituation: string;
  readonly finalState: SessionState;
  readonly turns: ReadonlyArray<SessionTurn>;
  readonly questionsAsked: ReadonlyArray<string>;
  readonly userAnswers: ReadonlyArray<string>;
  readonly rawOutputs: ReadonlyArray<string>;
  readonly failedTurns: ReadonlyArray<FailedTurn>;
  readonly finalDecision: RuntimeDecision | null;
}

export interface SessionStepResult {
  readonly turn: SessionTurn;
  readonly state: SessionState;
  readonly decision: RuntimeDecision;
  readonly shouldTerminate: boolean;
}

export class Session {
  private state: SessionState;
  // The four arrays below are mutated only by:
  //   1. `step()` appending to them as the session runs.
  //   2. `Session.restore()` populating them from a snapshot.
  // They are `private` (not `readonly`) to allow #2. External
  // callers cannot mutate them.
  private turns: SessionTurn[] = [];
  private questionsAsked: string[] = [];
  private userAnswers: string[] = [];
  private rawOutputs: string[] = [];
  private failedTurns: FailedTurn[] = [];
  private turnIndex = 0;

  constructor(
    initialSituation: string,
    private readonly client: HermesClient,
  ) {
    this.state = createInitialState(initialSituation);
  }

  get currentState(): SessionState {
    return this.state;
  }

  get askBudget(): number {
    return MAX_ASK_BUDGET;
  }

  async step(userAnswer?: string): Promise<SessionStepResult> {
    if (userAnswer !== undefined) {
      this.state = appendIntentEvidence(this.state, userAnswer);
      this.userAnswers.push(userAnswer);
    }

    const forced = isBudgetExhausted(this.state);
    const prompt = forced
      ? buildForcedSurfacePrompt(this.state)
      : buildSessionPrompt(this.state);

    const started = Date.now();
    const res = await this.client.oneShot({ prompt, safeMode: true });
    const durationMs = Date.now() - started;

    // Capture stateBefore the parse. The state of the session
    // at the moment the model was invoked is the minimum
    // fact we must preserve if parsing fails.
    const stateBefore = this.state;

    let decision: RuntimeDecision;
    try {
      if (forced) {
        const surface = parseForcedSurfaceDecision(res.stdout);
        decision = { action: 'surface', relationships: surface.relationships };
      } else {
        decision = parseRuntimeDecision(res.stdout);
      }
    } catch (err: unknown) {
      // A parse failure must never erase the fact that the
      // model invocation occurred. Record the failed turn and
      // throw a typed error that carries the record.
      // `turnIndex` is the index this turn WOULD have had —
      // we do NOT increment on failure, so a future retry of
      // the same turn will share the same turnIndex.
      const failedTurn: FailedTurn = {
        turnIndex: this.turnIndex + 1,
        rawOutput: res.stdout,
        error: err instanceof Error ? err.message : String(err),
        forced,
        stateBefore,
      };
      this.failedTurns.push(failedTurn);
      throw new SessionParseError(failedTurn);
    }

    this.rawOutputs.push(res.stdout);

    if (decision.action === 'ask') {
      this.questionsAsked.push(decision.question);
      this.state = incrementAskCount(this.state);
    }

    this.turnIndex += 1;
    const turn: SessionTurn = {
      turnIndex: this.turnIndex,
      decision,
      stateAfter: this.state,
      prompt,
      rawOutput: res.stdout,
      durationMs,
      forced,
    };
    this.turns.push(turn);

    const shouldTerminate = decision.action === 'surface';

    return { turn, state: this.state, decision, shouldTerminate };
  }

  timeline(): SessionTimeline {
    const last = this.turns[this.turns.length - 1];
    return {
      initialSituation: this.state.rawSituation,
      finalState: this.state,
      turns: this.turns.slice(),
      questionsAsked: this.questionsAsked.slice(),
      userAnswers: this.userAnswers.slice(),
      rawOutputs: this.rawOutputs.slice(),
      failedTurns: this.failedTurns.slice(),
      finalDecision: last ? last.decision : null,
    };
  }

  /**
   * Serialize the current session state to a `SessionSnapshot`.
   * Pure: does not touch the filesystem. Use
   * `writeSessionSnapshot` in `snapshot-io.ts` to persist.
   */
  toSnapshot(): SessionSnapshot {
    return snapshotFromTimeline(this.timeline());
  }

  /**
   * Restore a `Session` from a previously-built `SessionSnapshot`.
   * The restored session is wired to the same `HermesClient`
   * interface as a fresh session. The next call to `step()` is
   * the **first** new hermes invocation; prior turns are NOT
   * re-spawned.
   *
   * `state` and the timeline arrays (turns, questionsAsked,
   * userAnswers, rawOutputs) are populated from the snapshot
   * verbatim. The `turnIndex` advances so the next `step()`
   * returns turnIndex = N+1.
   */
  static restore(snapshot: SessionSnapshot, client: HermesClient): Session {
    const session = new Session(snapshot.state.rawSituation, client);
    // Overwrite the initial state and the four timeline arrays
    // with the snapshot's values. The constructor's empty
    // defaults are replaced; this is the entire restore step.
    session.state = snapshot.state;
    session.turns = snapshot.turns.map((t) => ({
      turnIndex: t.turnIndex,
      decision: t.decision,
      stateAfter: t.stateAfter,
      // `prompt` is not persisted (the prior prompt is not
      // needed to resume); the next `step()` rebuilds it.
      prompt: '',
      rawOutput: t.rawOutput,
      durationMs: t.durationMs,
      forced: t.forced,
    }));
    session.questionsAsked = snapshot.questionsAsked.slice();
    session.userAnswers = snapshot.userAnswers.slice();
    session.rawOutputs = snapshot.rawOutputs.slice();
    session.failedTurns = snapshot.failedTurns.map((f) => ({
      turnIndex: f.turnIndex,
      rawOutput: f.rawOutput,
      error: f.error,
      forced: f.forced,
      stateBefore: f.stateBefore,
    }));
    session.turnIndex = snapshot.turns.length;
    return session;
  }
}

/**
 * Helper: run a complete session with a pre-programmed
 * list of user answers. The helper drives the session until
 * the runtime surfaces (or throws if the runtime keeps
 * asking but no more user answers are queued).
 *
 * Flow:
 *   1. Run one step with no user input.
 *   2. If the runtime surfaces, return.
 *   3. If the runtime asks, consume the next user answer
 *      and run another step.
 *   4. Repeat until surface.
 *
 * The user-answer list is therefore "answers to give WHEN
 * the runtime asks", not "answers to provide upfront".
 */
export async function runSessionWithAnswers(
  initialSituation: string,
  client: HermesClient,
  userAnswers: ReadonlyArray<string>,
): Promise<SessionTimeline> {
  const session = new Session(initialSituation, client);
  let nextAnswerIdx = 0;
  let result = await session.step();
  while (!result.shouldTerminate) {
    if (nextAnswerIdx >= userAnswers.length) {
      throw new Error(
        'runSessionWithAnswers: runtime kept asking but no more queued user answers were provided',
      );
    }
    result = await session.step(userAnswers[nextAnswerIdx]!);
    nextAnswerIdx += 1;
  }
  return session.timeline();
}

/**
 * Helper: locate the final surface decision in a timeline,
 * or null if the session ended on an ask. Used by the
 * artifact renderer and the CLI.
 */
export function findFinalSurfaceDecision(
  timeline: SessionTimeline,
): SurfaceDecision | null {
  for (let i = timeline.turns.length - 1; i >= 0; i -= 1) {
    const t = timeline.turns[i]!;
    if (t.decision.action === 'surface') {
      return t.decision;
    }
  }
  return null;
}

/**
 * Helper: locate the latest ask decision in a timeline,
 * or null if none. Used by the CLI to render the question
 * after the runtime returns ask.
 */
export function findLatestAskDecision(
  timeline: SessionTimeline,
): AskDecision | null {
  for (let i = timeline.turns.length - 1; i >= 0; i -= 1) {
    const t = timeline.turns[i]!;
    if (t.decision.action === 'ask') {
      return t.decision;
    }
  }
  return null;
}
