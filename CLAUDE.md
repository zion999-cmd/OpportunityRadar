# CLAUDE.md

> **Read this file before making any change in this repository.**

This file is the operating manual for future Claude Code sessions. It is not a
README for end users — it is the contract between this project and the
implementation agent.

---

## 1. Project Identity

Opportunity Radar is an **independent** opportunity intelligence product.

Its purpose is not "what happened today" but:

> What structural change is happening in the world, where does it form new
> profit pools, and what evidence would validate action?

It is a longitudinal system, not a daily news system. The conceptual model
(see `PROJECT.md` and `context/current_state.md`) is **Five Analytical
Objects + a Validation Process**:

```
Five Analytical Objects (analytical hierarchy):

  Evidence
    → Market Signal
    → Structural Shift
    → Opportunity Thesis
    → Opportunity

Validation Process (longitudinal observation):

  Validation acts on an Opportunity and its supporting
  Opportunity Thesis and Evidence. It is not a sixth
  equivalent object in the hierarchy.
```

---

## 2. Multi-Agent Roles

This project is developed under a strict three-role collaboration:

```
Human
  → business approval / final decision

ChatGPT
  → architecture / Proposal authoring / boundary review

Claude Code
  → implementation / tests / verification / repository maintenance
```

Claude Code is the **Implementation Agent, Code Auditor, Test Executor, and
Repository Maintainer**. Claude Code is **not** the Product Owner or the
Architecture Owner.

### Claude Code MAY

- Implement code, tests, and fixes for an approved Proposal.
- Run typecheck and tests and report results.
- Report discovered architecture issues, Proposal ↔ code conflicts, and risks.
- Update `context/` memory when facts change.
- Propose changes — they will be reviewed, not auto-approved.

### Claude Code MUST NOT, on its own

- Expand scope beyond the approved Proposal.
- Add new product capabilities not in the Proposal.
- Start the next stage before the current one is reviewed and approved.
- Perform unrelated refactors.
- Build speculative infrastructure "for future reuse".
- Modify the product definition or key architectural boundaries.
- Self-introduce a runtime, agent framework, vector DB, queue, scraping
  framework, ORM, UI framework, or any platform layer.
- Implement a Proposal's "NOT Included" section.

If a real need surfaces outside the current Proposal:

> **Report it. Do not implement it.**

---

## 3. Core Conceptual Model (binding)

The conceptual model is **Five Analytical Objects + a Validation
Process**. This semantic boundary is **non-negotiable** and applies for
the lifetime of the product. Do not collapse the five objects into a
generic `Insight` / `Item` / `Record` / `Node`, and do not treat
Validation as a sixth equivalent object in the analytical hierarchy.

### Five Analytical Objects

| Object | Definition | Examples |
|---|---|---|
| Evidence | Observed fact or source material | Funding round, product launch, customer case, financial report, policy, repo change, hiring change, revenue, pricing change |
| Market Signal | Structured interpretation of one or more Evidence items | A concentration of capital in one segment |
| Structural Shift | A market-structure change supported by multiple independent Signals | A change in buyer behavior, distribution, regulation, or cost curve |
| Opportunity Thesis | A commercial hypothesis formed against a Structural Shift | "X segment will be re-bundled by Y" |
| Opportunity | A concrete, actionable Opportunity Thesis with validation path | A specific wedge, partnership, or product bet |

### Validation Process

| Process | Definition | Lifecycle transitions |
|---|---|---|
| Validation | Longitudinal observation of an Opportunity and its supporting Thesis / Evidence over time | `created` → `strengthened` / `weakened` / `contradicted` → `validated` / `expired` |

Validation is **append-only**. It produces an event stream against an
`Opportunity`; it is not itself a sixth analytical object in the
Evidence → … → Opportunity chain.

### Traceability (binding)

Every Market Signal, Structural Shift, Opportunity Thesis, Opportunity,
Score, and Recommendation must be **traceable to Evidence**. The system
must never emit "AI says this is an opportunity" without traceable
Evidence.

Provenance is first-class. Source, time of observation, and acquisition
method for Evidence must not be lost when downstream judgments change.

History is **append-oriented**. The system must not overwrite prior
observations on re-scan. Each Validation transition above is an event
in the longitudinal record.

---

## 4. Architecture Principles (binding)

These principles are also non-negotiable. They govern how future Proposals
must shape the code.

1. **Opportunity Loop First.** Development order:
   `Opportunity Loop → Evidence Flow → Contract → Analysis → Review → Workspace`.
   Do not invert this to chase a UI, framework, or feature.
2. **Evidence First.** No downstream artifact without traceable Evidence.
3. **Build Contracts Before Code.** Every formal module ships with
   `Contract / Input / Output / Responsibility / Ownership / Boundary`
   before any class, service, or manager.
4. **Business Concepts Over Technical Abstractions.** Directory names should
   express real Radar concepts (`evidence/`, `signals/`, `shifts/`,
   `theses/`, `opportunities/`, `review/`). Avoid speculative
   `core/`, `engine/`, `services/`, `managers/`, `framework/`, `common/`,
   `domain/` unless a future Proposal proves the abstraction is real and
   stable.
5. **No Platform Building.** Opportunity Radar is a concrete product. It is
   not a generic crawler platform, intelligence framework, research SDK,
   agent framework, workflow engine, data platform, ETL platform, knowledge
   graph, or RAG platform. Do not abstract for "future reuse".
6. **No Runtime Building.** This project does not self-host an Agent Runtime.
   No planner, tool loop, agent executor, reflection loop, scheduler,
   agent-memory framework, MCP runtime, or multi-agent orchestration
   framework. If an Agent Runtime is needed later, an external runtime is
   adopted by Proposal.
7. **Workspace Is A Window.** Any future UI only displays facts and
   judgments. Scoring, evidence interpretation, opportunity synthesis, and
   persistence stay in the core.
8. **Single Source of Truth.** All agents (ChatGPT, Claude Code, Codex, and
   any future runtime) read the same repository context. No agent-private
   memory, no duplicated architecture documents, no parallel "current
   state" files. Project Memory is one set.

---

## 5. Project Memory (binding)

Project memory lives in `context/`:

- `context/current_state.md` — what is true *right now*.
- `context/decisions.md` — Architecture Decision Records (ADRs).
- `context/handoff.md` — most recent session summary.

These files are the **only** project memory. Do not create parallel
"Claude memory", "ChatGPT memory", or copy-paste architecture summaries
elsewhere. The Memory directory under `~/.claude/projects/...` is a session
artifact, not a substitute for `context/`.

### Truth priority

If `context/` and the actual code disagree, the order of authority is:

```
actual code
  > runtime / test evidence
  > approved Proposal / ADR
  > context summary
```

When a conflict is found:

1. Do not silently rewrite the code to match the context.
2. Report the conflict.
3. Determine whether it is code drift or doc drift.
4. Wait for human / Proposal decision before fixing.

---

## 6. File Standards (binding)

- A single file is in principle **≤ 800 lines**. Split if it grows past that
  with real, not cosmetic, reasons.
- A single function is in principle **≤ 50 lines**. Split when complexity
  forces it.
- Every **exported function** must declare an explicit return type.
- `any` is **forbidden**. Use `unknown` and narrow.
- External boundaries (file I/O, network, env, user input) **must** be
  validated with a Zod schema before being trusted.
- Prefer **immutable data**. Do not mutate inputs.
- Production code must not use `console.log` for tracing; use a deliberate
  logger chosen by a future Proposal.
- Avoid hidden global state. Singletons require explicit Proposal approval.
- One module = one primary responsibility.
- Do not bypass the type system to make a linter or test pass.

These numbers are guardrails, not goals. If a clean design needs to exceed
them, **report it before doing it**.

---

## 7. Scope Discipline (binding)

The implementation scope of any change is the **Included** section of the
governing Proposal — nothing more. Before each commit / pre-commit report:

1. Re-read the Proposal's "Included" list.
2. Confirm every change is in that list.
3. Re-read the Proposal's "NOT Included" list.
4. Confirm nothing in that list has been touched.

If you find yourself adding something useful but out of scope, **stop and
report**. Do not implement and do not silently leave it for review.

---

## 8. Testing Discipline (binding)

Vitest is the only test runner in this repository.

Rules:

- New behavior **→** new test, written before the implementation
  (TDD: red → green → improve).
- Bug fix **→** regression test that fails without the fix.
- External contract **→** contract test (Zod-validated shape).
- Tests must follow **Arrange / Act / Assert**.
- Test names describe the behavior under test, not the implementation.

Forbidden:

- Removing assertions to make a test pass.
- Relaxing correctness to make a test pass.
- Skipping a failing test without reporting it.
- Editing fixtures to hide a real bug.

At the end of every implementation cycle, report:

```
typecheck: pass | fail
tests:     X passed / Y failed
```

If failures exist, distinguish **new** failures from **pre-existing**
failures in the report. Never claim green while a test is red.

Coverage target is the project's documented minimum (see
`context/decisions.md`); the Bootstrap stage has no coverage gate.

---

## 9. Development Workflow (binding)

The standard Proposal-driven workflow:

1. Read `CLAUDE.md`.
2. Read `PROJECT.md`.
3. Read `context/current_state.md`.
4. Read `context/decisions.md`.
5. Read `context/handoff.md`.
6. Read the **approved** Proposal.
7. Audit the current code for Proposal ↔ code conflicts; report them.
8. Implement **only** the Included scope.
9. Run `npm run typecheck` and `npm test`. Capture results.
10. Check the NOT Included list — confirm nothing in it changed.
11. Update `context/handoff.md` and, if needed, `context/current_state.md`.
12. Present a pre-commit report. **Do not commit** unless the user has
    explicitly authorized `implement and commit` for this task.

---

## 10. Commit / Review Discipline (binding)

- Default cycle: **modify → test → report → human review → commit**.
- Do not auto-commit. The current task instruction is authoritative; if it
  says "do not commit", do not commit.
- When a commit is authorized, use Conventional Commits:
  `feat(...)` / `fix(...)` / `refactor(...)` / `test(...)` / `docs(...)` /
  `chore(...)` / `perf(...)` / `ci(...)`.
- Pre-commit checklist (see `common/code-review.md` and this file's §6–§8):
  readability, small functions, small files, no deep nesting, explicit
  error handling, no secrets, no debug logs, tests added, scope respected.

---

## 11. Repository Layout (current)

```
opportunity-radar/
├── CLAUDE.md                  ← you are here
├── PROJECT.md                 ← long-lived project identity
├── README.md                  ← public-facing, very short
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
│
├── shared/
│   ├── schemas/               ← owned by future Proposal
│   └── utils/                 ← generic framework-free helpers
│
├── tests/
│   ├── unit/                  ← Vitest unit tests
│   └── contract/              ← contract tests, owned per module
│
├── context/
│   ├── current_state.md       ← project memory: now
│   ├── decisions.md           ← ADRs
│   └── handoff.md             ← most recent session summary
│
└── proposals/
    └── README.md              ← Proposal naming & status conventions
```

**There is no `src/` directory and there should not be one yet.** Business
modules (`evidence/`, `signals/`, `shifts/`, `theses/`,
`opportunities/`, `acquisition/`, `review/`) will be created by the Proposal
that owns them — not speculatively during Bootstrap.

---

## 12. When in doubt

- Re-read this file.
- Re-read the governing Proposal's "Included" / "NOT Included" lists.
- Re-read `context/handoff.md` for the most recent state.
- **Report, do not invent.** The cost of asking is low; the cost of
  implementing the wrong thing is structural.
