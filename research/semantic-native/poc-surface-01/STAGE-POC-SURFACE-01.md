# Stage Freeze — POC-SURFACE-01 Semantic Magazine Web Surface

> Documentation freeze for the recruiting-exhibit web surface.
> The Surface is a **window** (CLAUDE.md §4.7): it displays recovered
> meaning and relationships produced by the existing recruiting POC;
> it adds no analytical objects, no runtime, and no acquisition
> capability. This document records the factual state at freeze on
> **2026-09-13** (branch `feature/semantic-native-poc`).

## 0. Epistemic status legend

- **VERIFIED** — verified by build, automated tests, or live CDP
  measurement recorded below.
- **DESIGN INTENT** — implemented behavior mandated by `task.md`;
  not independently measurable (e.g. disabled placeholders).
- **KNOWN LIMITATION** — a fact that bounds what the freeze proves.

## 1. What froze

A React + Vite single-page Surface replacing the old vanilla
engineering-monitoring page of recruiting-exhibit:

- **VERIFIED** Desktop magazine surface (1440px capture): left nav,
  top header with current Situation, large hero semantic card,
  varying-size card grid, right Action Sidebar.
- **VERIFIED** Mobile surface (390px capture): mobile header, lens
  chips, hero, card grid, fixed bottom nav; no sidebars; no
  horizontal overflow (`scrollWidth === 390`).
- **VERIFIED** Three routes via a hand-rolled history router (no
  routing library):
  - `/` — magazine home;
  - `/meaning/:id` — recovered-meaning detail with a CSS-only
    vertical relationship flow (你的经历 → 恢复出的意义 →
    世界变化 → 潜在关系), Evidence trust layer with real
    click-through article URLs, the mandatory undeletable
    "Still Unknown / 仍然未知" section, and feedback;
  - `/radar` — the previous raw Observation Feed plus run control,
    moved off the home page.
- **VERIFIED** Desktop columns scroll independently: the shell is
  exactly `100vh` with `overflow: hidden`; `.leftnav` / `.main` /
  `.aside` are separate scroll containers with
  `overscroll-behavior: contain`. CDP measurements:
  document `scrollHeight === innerHeight` (document cannot scroll);
  center scrolled to 805 while window/nav/aside stayed 0; aside
  then scrolled to 121 while center kept 805; at 650px viewport
  height nav/main/aside all scroll independently and retain each
  other's offset. Mobile (≤1023px) reverts to natural document
  scrolling (window scroll 500, main container offset 0).

## 2. Scope boundaries honored

- **VERIFIED** No new analytical objects. `SemanticCard` is a
  frontend view model
  ([apps/recruiting-exhibit/web/src/view-models/semantic-card.ts](../../../apps/recruiting-exhibit/web/src/view-models/semantic-card.ts));
  it is not a domain schema and does not enter the Five Analytical
  Objects hierarchy.
- **VERIFIED** One relationship result → one card. No multi-source
  aggregation.
- **VERIFIED** Headlines render recovered meaning
  (`impliedMeaning`), never the raw reconstructed fact; the raw
  claim is the body summary. No 匹配度 / 置信度 / 推荐分 anywhere.
- **VERIFIED** Only the 求职/应聘 lens is functional; 投资机会 /
  行业研究 render disabled; comments, notifications, NL search,
  resume upload, auto-apply are non-functional placeholders
  (**DESIGN INTENT**).
- **VERIFIED** Demo filler cards are marked 「示例」 (`isDemo`),
  carry empty URLs, and their evidence links render disabled;
  feedback POST is disabled for demo cards. Real data always
  wins the hero position.
- **VERIFIED** Existing APIs only — no new endpoint:
  `GET/PUT /api/situation`, `GET /api/status`, `GET /api/inbox`,
  `GET /api/feed`, `POST /api/observation/run`,
  `POST /api/feedback`.
- Read-only API fields added: inbox `sourceTitle`, `rawExcerpt`;
  status `totalEvidenceCount`; `startServer` returns a `ready`
  promise. No DB contract change for the Surface; the
  `dedup_key` change belongs to the earlier `c4cd247` commit.
- **VERIFIED** Stack constraint: React 18 + Vite 5 + TypeScript
  strict + plain CSS + lucide-react only. No Tailwind, no UI
  framework, no Redux, no router library, no graph library.
  Images are local hand-authored SVG placeholders; the crawler
  was not extended.

## 3. Verification at freeze

- **VERIFIED** Production build: Vite emits to
  `apps/recruiting-exhibit/static/assets/` — JS 192.79 kB
  (gzip 61.67 kB), CSS 24.38 kB (gzip 5.54 kB).
  `npm run recruiting-exhibit` runs the build automatically via
  its `pre` hook and serves http://127.0.0.1:4173.
  Dev server: `npm run recruiting-exhibit:dev` (5173, /api
  proxied to 4173).
- **VERIFIED** `npm run typecheck`: pass (root tsc project +
  web tsc project).
- **VERIFIED** `npm test`: 565 passed / 0 failed across 61 files.
  The Surface adds 20 tests in 2 files only:
  - `tests/unit/apps/recruiting-exhibit/web-semantic-card.test.ts`
    (10) — meaning/title mapping, deterministic image, demo fill
    rules, empty demo URLs, findCard;
  - `tests/unit/apps/recruiting-exhibit/server-http.test.ts`
    (10) — real HTTP server: SPA fallback for `/meaning/:id` and
    `/radar`, SVG MIME, path-traversal rejection, situation
    default/PUT validation, status/inbox fields, feedback FK, 404.
- **VERIFIED** Live smoke against the local (gitignored) dev DB:
  a `POST /api/observation/run` returned 202 and surfaced new
  relationships; a partial source failure
  (`sources_failed=1/4 … timeout`) is visible verbatim on
  `/radar`. Local corpus at freeze: 27 reconstructed evidence,
  3 surfaced relationships — machine-local numbers, not
  reproducible from the repository.

## 4. Known limitations

1. **KNOWN LIMITATION** Fixed sources are English engineering
   blogs; Hermes's recovered meanings are therefore English.
   Typography handles long English text (line-clamp / wrapping);
   Chinese-magazine tone requires future Chinese corpus.
2. **KNOWN LIMITATION** Grid tail is filled with hand-authored
   demo cards whenever fewer than six real relationships exist.
   They are marked and link-disabled, but they are synthetic.
3. **KNOWN LIMITATION** 已保存 / 已申请 / 面试 have no
   persistence; the Action Sidebar shows 「—」 honestly rather
   than fabricated progress.
4. **KNOWN LIMITATION** Placeholder art is local SVG; no real
   image acquisition exists (explicitly out of scope; the
   crawler was not extended).
5. **KNOWN LIMITATION** Full-page screenshots cannot depict
   independent-column scrolling: with the fixed-viewport shell
   the document is exactly one viewport tall, so desktop
   screenshots are viewport captures. `desktop-home-scrolled.png`
   exists specifically to demonstrate that the center column
   scrolls while nav/header/aside stay fixed.
6. **KNOWN LIMITATION** The Surface was verified in headless
   Chromium only (1440 desktop, 1199/1023 breakpoints via CSS,
   390 mobile emulation). No Safari/Firefox pass was performed.

## 5. Artifacts

Screenshots in [screenshots/](screenshots/) (all captured
2026-09-13 against the frozen build):

| File | Viewport | Content |
|---|---|---|
| `desktop-home.png` | 1440×900 | Magazine home, fixed chrome |
| `desktop-home-scrolled.png` | 1440×900 | Center column scrolled; nav/header/aside fixed |
| `desktop-meaning-detail.png` | 1440×900 | Detail: recovered meaning, why-related, flow top |
| `desktop-radar.png` | 1440×900 | Metrics, run error record, raw feed |
| `mobile-home.png` | 390×844 | Mobile hero + lens chips + bottom nav |
| `mobile-grid.png` | 390×844 | Card grid after natural page scroll |
| `mobile-meaning-detail.png` | 390×844 | Detail mobile |
| `mobile-radar.png` | 390×844 | Radar mobile, 2-column metrics |

The human task inputs `task.md`, `pc.png`, `app.png` at the
repository root are deliberately **not** committed; they remain
local working documents owned by the human.

## 6. Freeze semantics

After this commit, POC-SURFACE-01 is frozen: no further Surface,
router, view-model, API, prompt, or acquisition changes should
land on its behalf without a new task / Proposal. Subsequent
recruiting-POC runtime work (observation, prompts, relationship
reasoning) is owned by its own stage, not by this Surface.
