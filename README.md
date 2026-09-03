# Opportunity Radar

Continuous opportunity intelligence.

Opportunity Radar watches external markets, lifts Evidence into Market
Signals, identifies Structural Shifts, and forms Opportunity Theses and
Opportunities with traceable validation history. It is a longitudinal
product, not a daily news feed.

The full product identity, conceptual model, and market assumptions live
in [`PROJECT.md`](./PROJECT.md). The operating contract for Claude Code
sessions lives in [`CLAUDE.md`](./CLAUDE.md). Project memory lives in
[`context/`](./context/).

## Status

**Bootstrap.** The repository installs, typechecks, and tests, but no
Opportunity Radar business capability exists yet. The first business
module will be introduced by `P0001` after this Bootstrap is reviewed and
approved. See `proposals/README.md` for the Proposal format.

## Requirements

- Node.js `>= 20`
- npm `>= 10`

## Install

```bash
npm install
```

## Typecheck

```bash
npm run typecheck
```

## Test

```bash
npm test
```

## What's next

- Human / ChatGPT review of the Bootstrap.
- Authoring of `P0001 — Evidence Foundation` (the first business Proposal).
- No business code, no infrastructure, no agent runtime, no UI will be
  added before `P0001` is approved.
