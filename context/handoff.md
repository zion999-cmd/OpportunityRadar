# Handoff — POC-SURFACE-01 frozen (Semantic Magazine Web Surface)

This is the most recent session summary. It is **not** a forecast; it is
a snapshot of what the last implementer (Claude Code) actually did, the
real state of the verification, and the things the next session should
read first.

## Current state

- Branch: `feature/semantic-native-poc` (base `main` @ `69ea22f`).
- **2026-09-13: POC-SURFACE-01 is FROZEN.** Two commits on top of
  `c4cd247`:
  1. `7b5916a` `feat(recruiting-exhibit): semantic magazine web
     surface (POC-SURFACE-01)` — implementation, tests, build
     artifacts.
  2. the docs commit directly after it (`docs(poc-surface-01):
     freeze semantic magazine web surface`) —
     [research/semantic-native/poc-surface-01/STAGE-POC-SURFACE-01.md](../research/semantic-native/poc-surface-01/STAGE-POC-SURFACE-01.md),
     screenshots, and this context update.
- The Surface replaces the old vanilla recruiting-exhibit
  monitoring page with a React + Vite single-page **window**
  (CLAUDE.md §4.7). It changes no analytical object, no runtime
  seam, no prompt, no acquisition behavior.
- **Verification at freeze: typecheck pass (root + web tsconfig
  projects); 565/565 tests pass across 61 files** (20 new in 2
  files); Vite build emits JS 192.79 kB (gzip 61.67 kB) + CSS
  24.38 kB (gzip 5.54 kB).
- The human task inputs `task.md`, `pc.png`, `app.png` at the
  repository root are **untracked on purpose** — human-owned
  working documents, not committed.
- The dev corpus (`data/dev.db`, gitignored) held 27 reconstructed
  evidence / 3 surfaced relationships at freeze; those numbers are
  machine-local and not reproducible from the repository.

## What the Surface is

- Stack (constrained by the task): React 18 + Vite 5 + TypeScript
  strict + plain CSS design tokens + lucide-react. No Tailwind, no
  UI framework, no Redux, no router library, no graph library.
  Source under [apps/recruiting-exhibit/web/](../apps/recruiting-exhibit/web/);
  build output replaces `apps/recruiting-exhibit/static/`.
- Routes (hand-rolled history router):
  - `/` magazine home — hero semantic card (newest real
    relationship) + varying-size grid; real relationship → one
    card; marked demo cards only fill the tail.
  - `/meaning/:id` — recovered meaning, "why this matters to you",
    CSS-only vertical relationship flow, Evidence trust layer with
    real article URLs, mandatory undeletable **Still Unknown**
    section, feedback.
  - `/radar` — the previous raw Observation Feed + run control.
- Only the 求职/应聘 lens is functional. Other lenses, NL search,
  comments, resume upload, notifications, auto-apply are disabled
  placeholders by design.
- Headlines are recovered meaning (`impliedMeaning`), never the raw
  reconstructed fact. No 匹配度/置信度/推荐分 anywhere.
- Desktop: shell is exactly `100vh`; `.leftnav` / `.main` /
  `.aside` scroll independently (`overscroll-behavior: contain`);
  route changes reset the main offset. ≤1023px reverts to natural
  document scrolling with mobile chrome.

## API surface (read-only additions only)

Reused endpoints — no new endpoint:
`GET/PUT /api/situation`, `GET /api/status`, `GET /api/inbox`,
`GET /api/feed`, `POST /api/observation/run`, `POST /api/feedback`.

Added fields: inbox `sourceTitle` + `rawExcerpt`; status
`totalEvidenceCount`; `startServer()` returns `{ stop, triggerNow,
ready }`. Static serving adds SPA history fallback and
path-traversal rejection.

## Verification — exact commands to re-run

```
npm install
npm run typecheck        # exit 0 (root tsc + web tsc)
npm test                 # 565 / 565 across 61 files
npm run recruiting-exhibit:web   # Vite production build -> static/
npm run recruiting-exhibit       # pre-hook builds, serves :4173
# dev with HMR:
npm run recruiting-exhibit:dev   # Vite :5173, /api -> 4173
```

CDP-verified scroll behavior at freeze: document
`scrollHeight === innerHeight` on desktop; scrolling main to 805
leaves window/nav/aside at 0; scrolling aside to 121 leaves main at
805; at 650px height nav/main/aside all scroll independently.
Mobile emulation (390×844): document scrolls naturally, main is not
a scroll container.

## Known limitations (freeze scope)

1. Real recovered meanings are English (fixed sources are English
   engineering blogs).
2. Demo filler cards (marked 「示例」, empty/disabled links) fill
   the grid when fewer than six real relationships exist.
3. 已保存/已申请/面试 unpersisted — sidebar honestly shows 「—」.
4. SVG placeholder art only; no image acquisition (explicitly out
   of scope).
5. Verified in headless Chromium only; no Safari/Firefox pass.

## Load-bearing boundaries for the next session

1. **The Surface is frozen.** No further Surface/router/view-model
   changes without a new task or Proposal.
2. `SemanticCard` is a frontend view model, not a sixth (or
   generic) analytical object — do not promote it into the Domain.
3. The six exhibit HTTP endpoints are the only contract the web
   app consumes; extending it is a new task.
4. Recruiting-POC runtime work (Hermes prompts, relationship
   reasoning, observation scheduling, acquisition) owns separate
   stages; do not bundle Surface changes into them.
5. Context drift note: older P0001/P0002 prose in
   `context/decisions.md` and `proposals/` predates the recruiting
   POC branch series (`768886c`…`c4cd247`). Authority remains
   actual code > runtime/test evidence > approved Proposal/ADR >
   context summary.

## What the next session should read first

1. `CLAUDE.md`, then `PROJECT.md`.
2. [research/semantic-native/poc-surface-01/STAGE-POC-SURFACE-01.md](../research/semantic-native/poc-surface-01/STAGE-POC-SURFACE-01.md)
   — the freeze audit with screenshot index.
3. The Surface entry points:
   [apps/recruiting-exhibit/web/src/app.tsx](../apps/recruiting-exhibit/web/src/app.tsx),
   [router.ts](../apps/recruiting-exhibit/web/src/router.ts),
   [view-models/semantic-card.ts](../apps/recruiting-exhibit/web/src/view-models/semantic-card.ts).
4. The server boundary:
   [apps/recruiting-exhibit/server.ts](../apps/recruiting-exhibit/server.ts),
   [views.ts](../apps/recruiting-exhibit/views.ts).
5. Prior stage freeze:
   [research/semantic-native/STAGE-RECRUITING-POC-01.md](../research/semantic-native/STAGE-RECRUITING-POC-01.md).

## Next proposed step

> None from the Surface side — it is frozen pending human review.
> Any change request arrives as a new task / Proposal; the
> implementer does not extend the Surface speculatively.
