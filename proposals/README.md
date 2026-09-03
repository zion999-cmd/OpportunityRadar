# Proposals

Every formal change to Opportunity Radar beyond trivial maintenance
starts with a Proposal. A Proposal is a short, scoped document that
makes the *contract of change* explicit before any code is written.

## Naming

```
P0001_title.md
P0002_title.md
P0002.1_title.md   ← sub-proposal / amendment of P0002
```

- IDs are zero-padded to 4 digits.
- Filenames are lowercase, snake-or-kebab — pick one and stay
  consistent within a Proposal series.
- The first formal Proposal is `P0001 — Evidence Foundation`.

## Status

A Proposal is in exactly one status at a time:

```
Proposed       drafted, awaiting human / ChatGPT review
Approved       accepted, ready for implementation
Implementing   an implementation cycle is in progress
Completed      shipped; status frozen; subsequent changes go in a
               new Proposal
Superseded     replaced by a later Proposal (link to successor)
Rejected       declined; kept for history
```

## Required sections (template)

A Proposal must contain, at minimum:

1. **Title & ID** — `P0NNN — <title>`.
2. **Status** — one of the values above.
3. **Context** — why this Proposal exists.
4. **Goal** — one-sentence outcome.
5. **Included** — explicit, exhaustive list of what will change.
6. **NOT Included** — explicit list of what will not change, including
   adjacent things that might *seem* in scope but are not.
7. **Contract** — input shape, output shape, responsibility,
   ownership, boundary (per `CLAUDE.md` §4.3).
8. **Directory impact** — which directories are created, modified,
   or remain untouched.
9. **Dependencies** — packages, runtimes, infrastructure.
10. **Tests required** — unit / contract / regression expectations.
11. **Open questions** — anything that must be answered before
    implementation.

If a section is empty, write "None" — never leave it blank. Empty
sections are evidence of incomplete scoping.

## Invariants

- A Proposal cannot be `Implementing` until it is `Approved`.
- A Proposal cannot be `Completed` while any item in its `Included`
  list is unaddressed.
- Code that lands without a corresponding `Approved` Proposal is a
  scope violation and must be reported, not silently accepted.
- `Superseded` Proposals are kept; their `## History` section must
  link to the replacement.

## Proposal index

| ID | Title | Status | Date |
|---|---|---|---|
| P0001 | Evidence Foundation | Completed | 2026-09-03 |

P0001 shipped the Evidence layer (contracts, normalization, Ground
Truth, SQLite substrate, repository, CLI) on 2026-09-03. Status
is frozen; subsequent changes to the Evidence layer go in a new
Proposal. Until P0002 is `Approved`, no Market Signal code,
schema, or derivation logic may be added.

## The next Proposal (after P0001 is Completed)

```
P0002 — Market Signal (proposed; not authored yet)
```

P0002 will introduce the second Analytical Object: a structured
interpretation of one or more Evidence items. Its scope must be
authored in its own Proposal file. Until P0002 is `Approved`, no
Market Signal code, schema, or signal-derivation logic may be
added.
