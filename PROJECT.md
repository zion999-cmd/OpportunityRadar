# PROJECT.md

Long-lived identity of the Opportunity Radar product. This file changes
slowly. When it changes, an ADR is required.

## Project Identity

Opportunity Radar is a **continuous opportunity intelligence** product.

Its job is to detect structural market changes early enough to identify
actionable business opportunities — and to keep doing so over time.

The product is fundamentally different from a news system:

| News system | Opportunity Radar |
|---|---|
| What happened? | What is changing? |
| Headline-of-the-day | Longitudinal pattern across evidence |
| Optimised for awareness | Optimised for decision support |
| Freshness is the metric | Signal durability is the metric |
| Single event | Five Analytical Objects (Evidence → Market Signal → Structural Shift → Opportunity Thesis → Opportunity) + a Validation Process that observes them |

## Primary Market Model

The current strategic assumption is:

```
Primary execution / commercialization market:
  China

Primary leading-indicator market:
  United States

Observation hypothesis:
  US may lead some China opportunity patterns by ~6–18 months
```

The 6–18 month lead is an **observation hypothesis**, not a hard-coded
business rule and not an algorithm constant. It exists to guide human
attention, not to constrain code.

This is not a permanent restriction. Future ADRs may extend coverage to
other geographies, but doing so requires an explicit decision.

## Core Conceptual Model

The model below is binding for the lifetime of the product. See `CLAUDE.md`
§3 for the full semantic table. It is **Five Analytical Objects + a
Validation Process**, not a six-element chain.

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

This file intentionally does **not** define a database schema, file
schema, or wire format. Those are owned by the Proposal that introduces
the corresponding module.

## What this product is NOT

- Not a generic crawler platform.
- Not a generic intelligence / research framework.
- Not a generic agent framework or workflow engine.
- Not a generic RAG / vector-DB / ETL / data-platform product.
- Not a news aggregator with a UI on top.
- Not a daily-brief product.

Any drift toward one of these shapes is an architecture event and must be
raised through a Proposal — never implemented silently.

## Status

The project is currently in **Bootstrap**: a minimal TypeScript repository
with strict rules, no business code, and no infrastructure. See
`context/current_state.md` and `context/handoff.md` for the current
snapshot.
