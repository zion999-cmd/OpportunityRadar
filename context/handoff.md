# Handoff — Bootstrap session

This is the most recent session summary. It is **not** a forecast; it is
a snapshot of what the last implementer (Claude Code) actually did, the
real state of the verification, and the things the next session should
read first.

## Current state

- Project status: **Bootstrap**.
- The repository is initialized, installs, typechecks, and tests.
- No business capability has been implemented.
- No commit has been made; the change set is uncommitted on `main`.

## What was initialized

- Git repository on branch `main`. No commits yet.
- Root configuration:
  `package.json`, `tsconfig.json` (strict, ES2022+, ESM,
  `moduleResolution: "Bundler"`, `noEmit`), `vitest.config.ts`,
  `.gitignore`.
- Directory skeleton: `shared/{schemas,utils}`, `tests/{unit,contract}`,
  `context/`, `proposals/`.
- Long-lived documents: `CLAUDE.md`, `PROJECT.md`, `README.md`.
- Project memory: `context/current_state.md`, `context/decisions.md`
  (ADRs 001–005), this file.
- Proposal conventions: `proposals/README.md`.
- One minimal Vitest test: `tests/unit/smoke.test.ts` (two assertions;
  no business concept).

## Architectural boundaries established

These are the load-bearing rules for the next session. Read them
before touching code.

1. **No `src/`.** Business modules grow out of approved Proposals.
2. **Business concepts over technical abstractions.** No `core/`,
   `engine/`, `services/`, `managers/`, `framework/`, `common/`,
   `domain/`, `platform/`, `runtime/`, `agents/`, `acquisition/`
   without an owning Proposal.
3. **No platform, no runtime, no DB, no vector store, no queue, no
   agent SDK, no UI, no scraping framework** — see ADR-001, ADR-004,
   ADR-005.
4. **Five Analytical Objects + Validation Process is binding.** The
   five analytical objects are Evidence → Market Signal → Structural
   Shift → Opportunity Thesis → Opportunity. Validation is a separate
   longitudinal process that observes an Opportunity and its
   supporting Thesis / Evidence. It is not a sixth equivalent object
   in the analytical hierarchy. See `PROJECT.md` and ADR-002.
5. **Project memory is one set** in `context/`. No agent-private
   memory files.
6. **Truth priority** (see `CLAUDE.md` §5): actual code >
   runtime/test evidence > approved Proposal / ADR > context summary.
7. **No auto-commit.** The current task explicitly forbade committing.

## Tests

- One test file: `tests/unit/smoke.test.ts`.
- Two assertions:
  1. A minimal Zod object schema parses a valid payload.
  2. The same schema rejects an empty `label` with the expected issue
     path.
- These exist solely to prove the Vitest + TypeScript + Zod pipeline
  end-to-end.

## Known risks

- **`moduleResolution: "Bundler"`** is appropriate for a
  Vitest-driven project but means the project cannot be executed
  directly with `node` against the TypeScript source. If a Proposal
  later needs a runnable entrypoint, it must revisit this choice
  explicitly (and add a run-time tool such as `tsx` via a new ADR).
- **No formatter, no linter** at Bootstrap. Style drift between
  sessions is possible. Adding Prettier / ESLint is deferred to a
  Proposal that needs them.
- **`@types/node` is pinned to the Node 22 major**, matching the
  `engines.node: ">=22"` baseline. A future Proposal that needs Node
  20 compatibility must revisit both pins together.
- **No coverage gate** in Bootstrap. The first Proposal that ships a
  real module should also define a coverage threshold.

## Next proposed step

> **Bootstrap is ready for human / ChatGPT review. P0001 has NOT
> started.**

P0001 should be authored only after the Bootstrap is reviewed and
accepted. The review should at minimum confirm:

- The Five Analytical Objects + Validation Process model in
  `PROJECT.md` is acceptable.
- The boundary rules in `CLAUDE.md` §2, §4, §7 are acceptable.
- The ADRs in `context/decisions.md` are acceptable.
- The minimal tooling and Node 22 baseline in `ADR-005` are
  acceptable.

Until P0001 is approved, no business code, no schema, no acquisition
logic, and no LLM / agent code may be added.
