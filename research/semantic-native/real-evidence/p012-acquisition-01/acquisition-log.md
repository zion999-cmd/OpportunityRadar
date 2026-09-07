# P012 Acquisition Log — Llobrera internal expert-service iteration

Acquisition date: 2026-09-07
Decisive unknown (frozen, verbatim): Whether P012's documented iterative
workflow-evolution practice was applied to internal expert service
operations where judgment and trust had to be preserved, rather than
only to client-facing design/development workflow, and whether it
produced durable mechanisms for converting observed expert work into
reusable product capability without degrading that expertise.

## Search infrastructure notes

- The general web search backend was unavailable for the full session
  (authentication failure on the search API: `403 Access denied`).
- All retrieval proceeded through `WebFetch` against targeted URLs.
- Multiple third-party search engines (Google, Bing, DuckDuckGo)
  returned redirects, captchas, 403/404, or zero relevant results
  during the session.
- GitHub CLI was not authenticated in the environment, so no
  `gh search` queries could be run.
- `web.archive.org` was unreachable from the retrieval environment.
- The LinkedIn profile returned HTTP 999; the AMNH internal search
  returned HTTP 403; the LOC search returned HTTP 403.
- No contact with the person was made, per the frozen plan.

## Queries / search paths attempted

1. `WebFetch` on `https://alistapart.com/author/mark-llobrera/` — HTTP 404.
2. `WebFetch` on `https://alistapart.com/author/markllobrera/` — HTTP 404.
3. `WebFetch` on `https://github.com/mllobrera` — HTTP 404.
4. `WebFetch` on `https://github.com/mllobrera?tab=repositories` — HTTP 404.
5. `WebFetch` on `https://github.com/mark-llobrera` — HTTP 404.
6. `WebFetch` on `https://www.smashingmagazine.com/author/mark-llobrera/`
   — HTTP 404.
7. `WebFetch` on `https://www.markllobrera.com` — HTTP 403.
8. `WebFetch` on `https://www.linkedin.com/in/markllobrera` — HTTP 999
   (LinkedIn blocks the retrieval interface).
9. `WebFetch` on
   `https://www.digitalpreservation.gov/news/2015/llobrera.html` — HTTP 404.
10. `WebFetch` on
    `https://www.bing.com/search?q=%22Mark+Llobrera%22+OR+%22M.+Llobrera%22+workflow+process`
    — search engine returned generic results for the word "mark"
    (Marks & Spencer, Bible Gateway, Wikipedia, dictionary entries).
    No attributed content.
11. `WebFetch` on
    `https://www.bing.com/search?q=%22Mark+Llobrera%22+article+process`
    — same generic results, no attributed content.
12. `WebFetch` on
    `https://www.bing.com/search?q=%22Mark+Llobrera%22+digital+stewardship`
    — same generic results, no attributed content.
13. `WebFetch` on
    `https://www.bing.com/search?q=%22Mark+Llobrera%22+site%3Aamnh.org`
    — generic results, no `amnh.org` results in the returned content.
14. `WebFetch` on
    `https://www.bing.com/search?q=%22Mark+Llobrera%22+site%3Aloc.gov`
    — generic results, no `loc.gov` results in the returned content.
15. `WebFetch` on
    `https://www.bing.com/search?q=%22Mark+Llobrera%22+%22workflow%22+article`
    — generic results, no relevant content.
16. `WebFetch` on
    `https://www.bing.com/search?q=%22Mark+Llobrera%22+%22A+List+Apart%22+workflow`
    — generic results, no relevant content.
17. `WebFetch` on `https://www.amnh.org/research/search?q=mark+llobrera`
    — HTTP 403.
18. `WebFetch` on `https://www.loc.gov/search/?q=%22mark+llobrera%22` —
    HTTP 403.
19. `WebFetch` on `https://www.digipres.org/author/mark-llobrera/`
    — socket closed.
20. `WebFetch` on `https://www.digipres.org/author/ml5e/` — HTTP 404.
21. `WebFetch` on `https://www.digipres.org/?s=llobrera` — landing
    page only, no article content for Llobrera; the page is a portal
    of links to external resources.
22. `WebFetch` on
    `https://www.dpworkshop.org/presenters/mark-llobrera/` — HTTP 404.
23. `WebFetch` on
    `https://blogs.loc.gov/digitalpreservation/author/ml5e@loc.gov/`
    — HTTP 403.
24. `WebFetch` on
    `https://blogs.loc.gov/digitalpreservation/2016/05/12/` — HTTP 403.
25. `WebFetch` on
    `https://www.digitalpreservation.gov/series/webcasts/` — HTTP 404.
26. `WebFetch` on `https://www.slideshare.net/MarkLlobrera` — page
    returned an error indicating a required part failed to load; no
    presentation list was extractable.
27. `WebFetch` on `https://medium.com/@markllobrera` — HTTP 403.
28. `WebFetch` on `https://www.researchgate.net/profile/Mark-Llobrera`
    — HTTP 403.
29. `WebFetch` on
    `https://web.archive.org/web/2023/https://www.markllobrera.com/`
    — `Claude Code is unable to fetch from web.archive.org`.
30. `WebFetch` on
    `https://web.archive.org/web/2022/https://alistapart.com/author/markllobrera/`
    — `Claude Code is unable to fetch from web.archive.org`.

## Plausible candidates inspected (with accept / reject reason)

| # | Candidate | Source of the candidate | Accept / Reject | Reason |
|---|---|---|---|---|
| C1 | "Prototyping Your Workflow" — the A List Apart article at `https://alistapart.com/ala396_workflow_300-png/` | The admitted P012 source in pilot-01 (frozen) | **Reject** | This is the only P012 source admitted into pilot-01. The decisive unknown explicitly excludes client-facing design/development workflow. The article describes "a digital agency using a museum website redesign to test several new ways of connecting design and development" with modular content/layout, front-end style guides, and code-based wireframes across three projects (museum site, literary magazine, a colleague's project), plus a monthly all-staff meeting. The observed work is client-facing design/development deliverables, not an internal expert service operation where judgment and trust had to be preserved. The article does not document a "real internal expert-service or expert-judgment workflow" as the frozen evidence standard requires. The specific missing requirement is the expert-service context; the article's tension is design/development workflow under live project constraints, not the preservation of expert judgment and the durable conversion of observed expert work into reusable capability. |
| C2 | Personal site `markllobrera.com` | First-party primary candidate | **Inconclusive** | HTTP 403 on every fetch attempt during the session. No archived snapshot was available through the retrieval environment. Could not be inspected in this pass. |
| C3 | LinkedIn profile `linkedin.com/in/markllobrera` | Standard professional-biosphere tertiary source | **Inconclusive** | LinkedIn returned HTTP 999 to the retrieval interface; no information could be extracted. |
| C4 | A List Apart author page (`alistapart.com/author/mark-llobrera/` and `/markllobrera/`) | First-party primary candidate | **Inconclusive** | Both returned HTTP 404 in this session; no author index could be inspected. |
| C5 | GitHub accounts `mllobrera` and `mark-llobrera` | First-party primary candidate | **Inconclusive** | Both returned HTTP 404 in this session; no repositories could be inspected. |
| C6 | Smashing Magazine author page | First-party primary candidate | **Inconclusive** | HTTP 404; no author index could be inspected. |
| C7 | LOC and AMNH staff / search pages | First-party institutional primary candidate | **Inconclusive** | All returned HTTP 403. The LOC digital-preservation blog author page for the `ml5e@loc.gov` handle also returned 403. No staff or post page could be inspected. |
| C8 | `digipres.org/author/mark-llobrera/` and `/author/ml5e/` | First-party community primary candidate | **Inconclusive** | The first returned a socket-closed; the second returned HTTP 404. The DigiPres landing page for "llobrera" is a portal only, with no attributed content extractable. |
| C9 | NDSA, DPWorkshop, and digital-preservation webcast indices | Plausible talk venues for a digital-preservation practitioner | **Inconclusive** | All returned HTTP 403/404 in this session. No talk list could be inspected. |
| C10 | SlideShare profile | Plausible talk-archive tertiary candidate | **Inconclusive** | The page returned a partial-load error; no presentation list was extractable. |
| C11 | Medium profile | Plausible first-person retrospective venue | **Inconclusive** | HTTP 403. |
| C12 | ResearchGate profile | Plausible attribution tertiary source | **Inconclusive** | HTTP 403. |
| C13 | Web searches on Bing (six different query variants) and DuckDuckGo (one query) | Standard public-web search | **Inconclusive** | All returned generic results for the word "mark" and did not surface attributable Llobrera content. Web-search API backend was unavailable (`403 Access denied`). |
| C14 | Archived snapshots via web.archive.org | Standard archived-snapshot fallback | **Inconclusive** | `web.archive.org` was unreachable from the retrieval environment. |

## Summary of the gap

Across the inspected surface, the only Llobrera-attributed public source
retrievable in this session is the already-admitted A List Apart
article, which the frozen decisive unknown explicitly excludes
(client-facing design/development workflow, not internal expert service
operations). All other plausible attribution sources — personal site,
LinkedIn, A List Apart author index, GitHub, Smashing Magazine, LOC,
AMNH, NDSA, DPWorkshop, SlideShare, Medium, ResearchGate, and
third-party search engines — were either blocked by HTTP 403/404/999,
returned zero relevant content, or were unreachable from the
retrieval environment.

No attributable source emerged that would establish:

1. an internal expert-service or expert-judgment workflow that Llobrera
   iterated on;
2. preservation or explicit handling of judgment/trust/context under
   that iteration;
3. a durable reusable process, system, artifact, or capability
   resulting from that learning.

The decisive gap that remained unsupported is the first one: no
public attributable source establishes a real internal expert-service
or expert-judgment workflow for Llobrera. Without that link, the
second and third cannot be evaluated against the same person. The
admitted A List Apart article covers a different workflow domain
(client-facing design/development at a digital agency) and the
frozen acquisition requirement explicitly excludes that domain.

**Acquisition route terminates as unresolved**, consistent with the
frozen plan's contingency for the case where no attributable
candidate is publicly identifiable.
